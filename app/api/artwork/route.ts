import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { customerArtworks, orderItems, productSizes, products, storageAssets, templateSizes } from '@/lib/db/schema'
import { getSession } from '@/lib/auth/middleware'
import { getAdminSession } from '@/lib/auth/require-admin'
import { deleteObject, uploadObject, createPresignedDownloadUrl } from '@/lib/storage/r2'
import { registerStorageAsset } from '@/lib/storage/asset-records'
import { R2_PATHS } from '@/lib/storage/r2-paths'
import { sanitizeFilename } from '@/lib/storage/upload-validation'
import { sanitizeSvgMarkup } from '@/lib/templates/svg-sanitization'
import { createHash } from 'node:crypto'

const allowed = new Map([['application/pdf', ['pdf']], ['image/png', ['png']], ['image/svg+xml', ['svg']], ['application/postscript', ['eps']], ['application/eps', ['eps']]])
const MAX_BYTES = 100 * 1024 * 1024
function safeText(value: FormDataEntryValue | null, max = 2000) { return typeof value === 'string' ? value.trim().slice(0, max) : '' }
function validateBytes(type: string, body: Buffer) { if (type === 'application/pdf' && !body.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new Error('The PDF signature is invalid.'); if (type === 'image/png' && body.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('The PNG signature is invalid.'); if ((type === 'application/postscript' || type === 'application/eps') && !body.subarray(0, 20).toString('ascii').startsWith('%!PS-Adobe')) throw new Error('The EPS signature is invalid.') }

export async function POST(request: NextRequest) {
  const session = await getSession(); if (!session?.user) return NextResponse.json({ error: { message: 'Sign in to upload print artwork.' } }, { status: 401 })
  let key = ''
  try {
    const form = await request.formData(); const file = form.get('file'); if (!(file instanceof File)) throw new Error('Select an artwork file.')
    const extension = file.name.split('.').pop()?.toLowerCase() || ''; if (!allowed.get(file.type)?.includes(extension)) throw new Error('Supported artwork formats are PDF, PNG, SVG, and EPS.')
    if (!file.size || file.size > MAX_BYTES) throw new Error('Artwork must be between 1 byte and 100 MB.')
    const productId = safeText(form.get('productId'), 50); const sizeId = safeText(form.get('sizeId'), 50)
    const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1); if (!product?.active) throw new Error('The selected product is unavailable.')
    let templateSizeId: string | null = null; let productSizeId: string | null = null
    if (product.templateId) { const [size] = await db.select().from(templateSizes).where(and(eq(templateSizes.id, sizeId), eq(templateSizes.templateId, product.templateId))).limit(1); if (!size?.enabled) throw new Error('The selected template size is unavailable.'); templateSizeId = size.id }
    else { const [size] = await db.select().from(productSizes).where(and(eq(productSizes.id, sizeId), eq(productSizes.productId, product.id))).limit(1); if (!size?.enabled) throw new Error('The selected product size is unavailable.'); productSizeId = size.id }
    const source = Buffer.from(await file.arrayBuffer()); validateBytes(file.type, source)
    const body = file.type === 'image/svg+xml' ? Buffer.from(sanitizeSvgMarkup(source.toString('utf8')), 'utf8') : source
    key = `${R2_PATHS.artworkUploads}/${session.user.id.replace(/[^a-zA-Z0-9_-]/g, '')}/${crypto.randomUUID()}-${sanitizeFilename(file.name)}`
    const checksum = createHash('sha256').update(body).digest('hex')
    await uploadObject({ key, body, contentType: file.type, metadata: { owner: session.user.id, originalName: file.name.slice(0, 250), checksum, private: 'true' } })
    const artwork = await db.transaction(async (tx) => {
      const asset = await registerStorageAsset({ key, contentType: file.type, size: body.length, uploadedBy: null, etag: checksum })
      await tx.update(storageAssets).set({ access: 'private' }).where(eq(storageAssets.id, asset.id))
      const [row] = await tx.insert(customerArtworks).values({ userId: session.user.id, productId: product.id, templateSizeId, productSizeId, assetId: asset.id, originalFilename: file.name.slice(0, 255), notes: safeText(form.get('notes')), orientation: ['portrait','landscape'].includes(safeText(form.get('orientation'))) ? safeText(form.get('orientation')) : 'unspecified', quantityReference: Math.max(1, Math.min(1000, Number(form.get('quantityReference')) || 1)) }).returning()
      return row
    })
    return NextResponse.json({ data: { artwork: { ...artwork, previewUrl: file.type === 'image/png' || file.type === 'image/svg+xml' ? await createPresignedDownloadUrl(key) : null } } }, { status: 201 })
  } catch (error) { if (key) await deleteObject(key).catch(() => undefined); return NextResponse.json({ error: { message: error instanceof Error ? error.message : 'Artwork upload failed.' } }, { status: 400 }) }
}

export async function GET(request: NextRequest) {
  const [session, admin] = await Promise.all([getSession(), getAdminSession()]); if (!session?.user && !admin?.user) return NextResponse.json({ error: { message: 'Sign in is required.' } }, { status: 401 })
  const id = request.nextUrl.searchParams.get('id'); if (!id) return NextResponse.json({ error: { message: 'Artwork ID is required.' } }, { status: 400 })
  const [row] = await db.select({ artwork: customerArtworks, asset: storageAssets }).from(customerArtworks).innerJoin(storageAssets, eq(customerArtworks.assetId, storageAssets.id)).where(eq(customerArtworks.id, id)).limit(1)
  if (!row) return NextResponse.json({ error: { message: 'Artwork not found.' } }, { status: 404 })
  if (!admin?.user && row.artwork.userId !== session?.user.id) return NextResponse.json({ error: { message: 'You cannot access another customer’s artwork.' } }, { status: 403 })
  return NextResponse.json({ data: { artwork: { ...row.artwork, contentType: row.asset.contentType, downloadUrl: await createPresignedDownloadUrl(row.asset.objectKey) } } }, { headers: { 'cache-control': 'private, no-store' } })
}

export async function DELETE(request: NextRequest) {
  const session = await getSession(); if (!session?.user) return NextResponse.json({ error: { message: 'Sign in is required.' } }, { status: 401 })
  const { id } = await request.json() as { id?: string }; const [row] = await db.select({ artwork: customerArtworks, asset: storageAssets }).from(customerArtworks).innerJoin(storageAssets, eq(customerArtworks.assetId, storageAssets.id)).where(and(eq(customerArtworks.id, id || ''), eq(customerArtworks.userId, session.user.id))).limit(1)
  if (!row) return NextResponse.json({ error: { message: 'Artwork not found.' } }, { status: 404 })
  const used = await db.select({ id: orderItems.id }).from(orderItems).where(eq(orderItems.customerArtworkId, row.artwork.id)).limit(1)
  if (used.length) return NextResponse.json({ error: { message: 'Artwork attached to an order cannot be removed.' } }, { status: 409 })
  await db.transaction(async (tx) => { await tx.delete(customerArtworks).where(eq(customerArtworks.id, row.artwork.id)); await tx.delete(storageAssets).where(eq(storageAssets.id, row.asset.id)) }); await deleteObject(row.asset.objectKey)
  return NextResponse.json({ data: { deleted: row.artwork.id } })
}
