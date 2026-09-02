import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/middleware'
import { canvasUploadChunkSize, friendlyCanvasUploadError, validateCanvasUploadManifest } from '@/lib/storage/canvas-uploads'
import { completeCanvasImageUpload, storeCanvasImage, storeCanvasImageChunk } from '@/lib/storage/canvas-image-storage'
import { R2ConfigurationError } from '@/lib/storage/r2'
import { UploadValidationError, validateUpload } from '@/lib/storage/upload-validation'
import { SvgValidationError } from '@/lib/templates/svg-sanitization'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    // A custom header prevents credentialed cross-origin form submissions.
    if (request.headers.get('x-canvas-upload') !== '1') return NextResponse.json({ error: { message: 'Upload failed. Try again.' } }, { status: 403 })
    const session = await getSession()
    if (!session?.user) return NextResponse.json({ error: { code: 'UPLOAD_NOT_AUTHORIZED', message: 'Sign in to store uploaded artwork.' } }, { status: 401 })
    const options = { status: 201, headers: { 'cache-control': 'private, no-store' } }
    if (request.headers.get('content-type')?.includes('application/json')) {
      const input = await request.json() as { manifest?: unknown }
      const manifest = validateCanvasUploadManifest(input.manifest)
      return NextResponse.json({ data: await completeCanvasImageUpload(session.user.id, manifest) }, options)
    }
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) throw new UploadValidationError('INVALID_UPLOAD', 'Select a PNG, JPEG, WEBP, or SVG file.')
    const manifestJson = form.get('manifest')
    if (typeof manifestJson === 'string') {
      const manifest = validateCanvasUploadManifest(JSON.parse(manifestJson))
      const indexText = form.get('index')
      if (typeof indexText !== 'string' || !/^\d$/.test(indexText)) throw new UploadValidationError('INVALID_UPLOAD', 'Upload failed. Try again.')
      const index = Number(indexText)
      if (file.size !== canvasUploadChunkSize(manifest, index)) throw new UploadValidationError('INVALID_UPLOAD', 'Upload failed. Try again.')
      return NextResponse.json({ data: await storeCanvasImageChunk(session.user.id, manifest, index, Buffer.from(await file.arrayBuffer())) }, options)
    }
    const requestData = { filename: file.name, contentType: file.type, size: file.size, purpose: 'logo' as const }
    validateUpload(requestData)
    const source = Buffer.from(await file.arrayBuffer())
    return NextResponse.json({ data: await storeCanvasImage(session.user.id, requestData, source) }, options)
  } catch (error) {
    if (error instanceof UploadValidationError) return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: 400 })
    if (error instanceof SvgValidationError) return NextResponse.json({ error: { code: 'UNSAFE_SVG', message: friendlyCanvasUploadError(error) } }, { status: 400 })
    if (error instanceof R2ConfigurationError) return NextResponse.json({ error: { code: error.code, message: 'Artwork storage is temporarily unavailable. Try again later.' } }, { status: 503 })
    console.error('Canvas image upload failed', error)
    return NextResponse.json({ error: { code: 'UPLOAD_FAILED', message: friendlyCanvasUploadError(error) } }, { status: 500 })
  }
}
