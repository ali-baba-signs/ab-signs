import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { customerArtworks, storageAssets } from '@/lib/db/schema'
import { getSession } from '@/lib/auth/middleware'
import { getAdminSession } from '@/lib/auth/require-admin'
import { getObjectBody } from '@/lib/storage/r2'
import { sanitizeSvgMarkup } from '@/lib/templates/svg-sanitization'

export async function GET(request: NextRequest) {
  const [session, admin] = await Promise.all([getSession(), getAdminSession()])
  if (!session?.user && !admin?.user) return NextResponse.json({ error: { message: 'Sign in is required.' } }, { status: 401 })
  const id = request.nextUrl.searchParams.get('id') || ''
  try {
    const [row] = await db.select({ artwork: customerArtworks, asset: storageAssets }).from(customerArtworks).innerJoin(storageAssets, eq(customerArtworks.assetId, storageAssets.id)).where(eq(customerArtworks.id, id)).limit(1)
    if (!row) return NextResponse.json({ error: { message: 'Artwork preview not found.' } }, { status: 404 })
    if (!admin?.user && row.artwork.userId !== session?.user.id) return NextResponse.json({ error: { message: 'Artwork preview access denied.' } }, { status: 403 })
    if (!['image/png','image/svg+xml','application/pdf'].includes(row.asset.contentType)) return NextResponse.json({ error: { message: 'A safe inline preview is not available for this format.' } }, { status: 415 })
    const source = await getObjectBody(row.asset.objectKey)
    const body = row.asset.contentType === 'image/svg+xml' ? Buffer.from(sanitizeSvgMarkup(source.toString('utf8'))) : source
    return new NextResponse(body, { headers: { 'content-type': row.asset.contentType, 'content-disposition': `inline; filename="preview.${row.asset.contentType === 'application/pdf' ? 'pdf' : row.asset.contentType === 'image/png' ? 'png' : 'svg'}"`, 'cache-control': 'private, no-store', 'content-security-policy': "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox" } })
  } catch (error) {
    console.error('Artwork preview failed', error)
    return NextResponse.json({ error: { message: 'The artwork preview could not be generated safely.' } }, { status: 500 })
  }
}
