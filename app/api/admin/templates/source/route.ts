import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { storageAssets } from '@/lib/db/schema'
import { getAdminSession } from '@/lib/auth/require-admin'
import { getObjectBody, R2ConfigurationError } from '@/lib/storage/r2'
import { sanitizeSvgMarkup, SvgValidationError } from '@/lib/templates/svg-sanitization'

export async function GET(request: NextRequest) {
  if (!(await getAdminSession())) return NextResponse.json({ error: { code: 'UNAUTHORIZED_CONVERSION', message: 'Admin access is required to retrieve a template source.' } }, { status: 401 })
  const assetId = request.nextUrl.searchParams.get('assetId') || ''
  try {
    const [asset] = await db.select().from(storageAssets).where(eq(storageAssets.id, assetId)).limit(1)
    if (!asset || asset.contentType !== 'image/svg+xml' || !asset.objectKey.startsWith('design-editor/templates/')) {
      return NextResponse.json({ error: { code: 'SVG_NOT_FOUND', message: 'The SVG storage object was not found. Upload the source again or repair its asset reference.' } }, { status: 404 })
    }
    const source = sanitizeSvgMarkup((await getObjectBody(asset.objectKey)).toString('utf8'))
    return new NextResponse(source, { headers: { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'private, no-store' } })
  } catch (error) {
    console.error('Template SVG retrieval failed', error)
    if (error instanceof SvgValidationError) return NextResponse.json({ error: { code: 'SVG_SANITIZATION_REJECTED', message: `SVG sanitization rejected the stored file: ${error.message}` } }, { status: 422 })
    if (error instanceof R2ConfigurationError) return NextResponse.json({ error: { code: 'R2_NOT_CONFIGURED', message: 'Unable to retrieve the SVG because R2 storage is not configured.' } }, { status: 503 })
    const missing = error instanceof Error && /not.?found|no.?such.?key|404/i.test(`${error.name} ${error.message}`)
    return NextResponse.json({ error: { code: missing ? 'R2_OBJECT_NOT_FOUND' : 'R2_REQUEST_FAILED', message: missing ? 'The SVG file could not be retrieved from storage. Check the stored object reference and R2 access configuration.' : 'R2 could not return the SVG source. Check storage credentials and retry.' } }, { status: missing ? 404 : 502 })
  }
}
