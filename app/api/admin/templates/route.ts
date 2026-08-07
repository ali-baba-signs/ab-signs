import { NextRequest, NextResponse } from 'next/server'
import { asc, desc, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { adminActivityLogs, storageAssets, templates, templateSizes } from '@/lib/db/schema'
import { getAdminSession } from '@/lib/auth/require-admin'
import { activityValues } from '@/lib/admin/activity'
import { validateTemplateInput } from '@/lib/templates/validation'
import { getStoredAssetUrl } from '@/lib/storage/r2-public-url'

export async function GET() {
  if (!(await getAdminSession())) return NextResponse.json({ error: { code: 'ADMIN_REQUIRED', message: 'Admin access is required.' } }, { status: 401 })
  try {
    const [rows, sizes] = await Promise.all([db.select().from(templates).orderBy(desc(templates.updatedAt)), db.select().from(templateSizes).orderBy(asc(templateSizes.displayOrder))])
    return NextResponse.json({ data: { templates: rows.map((row) => ({ ...row, sizes: sizes.filter((size) => size.templateId === row.id) })) } }, { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    console.error('Template list failed', error)
    return NextResponse.json({ error: { code: 'TEMPLATES_LOAD_FAILED', message: 'Templates could not be loaded. Apply the latest database migration and try again.' } }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: { code: 'ADMIN_REQUIRED', message: 'Admin access is required.' } }, { status: 401 })
  try {
    const input = validateTemplateInput(await request.json())
    if (!input.assets.previewImage || !input.assets.svg) throw new Error('Upload both a preview image and an SVG template source.')
    const assetIds = [input.assets.previewImage.id, input.assets.svg.id]
    const assetRows = await db.select().from(storageAssets).where(inArray(storageAssets.id, assetIds))
    const preview = assetRows.find((asset) => asset.id === input.assets.previewImage!.id)
    const svg = assetRows.find((asset) => asset.id === input.assets.svg!.id)
    if (!preview?.contentType.startsWith('image/') || preview.contentType === 'image/svg+xml') throw new Error('Template preview must be a WEBP, PNG, or JPEG image.')
    if (svg?.contentType !== 'image/svg+xml') throw new Error('Editable template source must be an SVG file.')
    if (!input.svgChecksum || svg.etag !== input.svgChecksum) throw new Error('The generated data checksum does not match the uploaded sanitized SVG.')
    const [created] = await db.transaction(async (tx) => {
      const rows = await tx.insert(templates).values({
        name: input.name, description: input.description, category: input.category, status: input.status,
        canvasData: input.canvasData!, thumbnail: getStoredAssetUrl(preview.objectKey),
        previewImageUrl: getStoredAssetUrl(preview.objectKey), previewImageKey: preview.objectKey, previewAssetId: preview.id,
        svgUrl: getStoredAssetUrl(svg.objectKey), svgKey: svg.objectKey, svgAssetId: svg.id,
        physicalWidth: input.width.toString(), physicalHeight: input.height.toString(), measurementUnit: input.unit,
        logicalCanvasWidth: input.logicalCanvasWidth, logicalCanvasHeight: input.logicalCanvasHeight,
        scaleMetadata: input.scaleMetadata, templateVersion: 1,
        svgChecksum: input.svgChecksum, conversionVersion: input.conversionVersion, conversionStatus: 'ready', conversionError: null, generatedAt: new Date(),
      }).returning()
      await tx.insert(templateSizes).values(input.sizes.map((size) => ({ templateId: rows[0].id, label: size.label, width: size.width.toString(), height: size.height.toString(), unit: size.unit, fitMode: size.fitMode, safeMargin: size.safeMargin.toString(), enabled: size.enabled, isDefault: size.isDefault, displayOrder: size.displayOrder })))
      await tx.insert(adminActivityLogs).values(activityValues(session, { actionType: 'template.created', entityType: 'template', entityId: rows[0].id, entityName: rows[0].name, description: `Created SVG editable template ${rows[0].name}.`, metadata: { category: rows[0].category, status: rows[0].status, width: input.width, height: input.height, unit: input.unit } }))
      return rows
    })
    return NextResponse.json({ data: { template: created } }, { status: 201 })
  } catch (error) {
    console.error('Template create failed', error)
    return NextResponse.json({ error: { code: 'TEMPLATE_CREATE_FAILED', message: error instanceof Error ? error.message : 'The template could not be created.' } }, { status: 400 })
  }
}
