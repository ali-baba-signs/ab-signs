import { NextRequest } from 'next/server'
import { db } from '@/lib/db/client'
import { designs, designVersions } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api/responses'
import { getSession } from '@/lib/auth/middleware'
import { getUserRole } from '@/lib/auth/roles'
import type { CanvasData } from '@/types'

/**
 * GET /api/designs
 * Fetch user's designs
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session) {
      return unauthorizedResponse()
    }

    const userDesigns = await db
      .select()
      .from(designs)
      .where(eq(designs.userId, session.user.id))
      .orderBy(desc(designs.updatedAt))

    return successResponse({ designs: userDesigns })
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Failed to fetch designs', 500)
  }
}

/**
 * POST /api/designs
 * Create a new design
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session) {
      return unauthorizedResponse()
    }

    const body = await request.json()
    const { name, description, canvasData, templateId, productId, isPublic } = body

    if (!name || !canvasData) {
      return errorResponse('Missing required fields: name, canvasData', 400)
    }

    const newDesign = await db
      .insert(designs)
      .values({
        userId: session.user.id,
        name,
        description,
        canvasData,
        templateId,
        productId,
        isPublic: isPublic || false,
      })
      .returning()

    // Create initial version
    await db.insert(designVersions).values({
      designId: newDesign[0].id,
      version: 1,
      canvasData,
    })

    return successResponse({ design: newDesign[0] }, 201)
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Failed to create design', 500)
  }
}

/**
 * PUT /api/designs/[id]
 * Update a design
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session) {
      return unauthorizedResponse()
    }

    const body = await request.json()
    const { id, name, description, canvasData, thumbnail } = body

    if (!id) {
      return errorResponse('Design ID is required', 400)
    }

    // Verify ownership
    const design = await db.select().from(designs).where(eq(designs.id, id))

    if (!design.length) {
      return errorResponse('Design not found', 404)
    }

    if (design[0].userId !== session.user.id && getUserRole(session.user) !== 'admin') {
      return errorResponse('Unauthorized to update this design', 403)
    }

    // Get latest version number
    const latestVersion = await db
      .select()
      .from(designVersions)
      .where(eq(designVersions.designId, id))
      .orderBy(desc(designVersions.version))

    const nextVersion = (latestVersion[0]?.version || 0) + 1

    // Create new version
    if (canvasData) {
      await db.insert(designVersions).values({
        designId: id,
        version: nextVersion,
        canvasData,
      })
    }

    // Update design
    const updatedDesign = await db
      .update(designs)
      .set({
        name: name || design[0].name,
        description: description !== undefined ? description : design[0].description,
        canvasData: canvasData || design[0].canvasData,
        thumbnail: thumbnail || design[0].thumbnail,
        updatedAt: new Date(),
      })
      .where(eq(designs.id, id))
      .returning()

    return successResponse({ design: updatedDesign[0] })
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Failed to update design', 500)
  }
}
