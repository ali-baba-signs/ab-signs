import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/middleware'
import { designRenderChunkSize, friendlyDesignRenderError, validateDesignRenderManifest } from '@/lib/storage/design-render-uploads'
import { completeDesignRenderUpload, storeDesignRenderChunk } from '@/lib/storage/design-render-storage'
import { R2ConfigurationError } from '@/lib/storage/r2'
import { UploadValidationError } from '@/lib/storage/upload-validation'
import { SvgValidationError } from '@/lib/templates/svg-sanitization'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    if (request.headers.get('x-design-render-upload') !== '1') return NextResponse.json({ error: { message: 'The generated artwork upload could not be authorized.' } }, { status: 403 })
    const session = await getSession()
    if (!session?.user) return NextResponse.json({ error: { code: 'UPLOAD_NOT_AUTHORIZED', message: 'Your session expired. Sign in again, then retry saving the design.' } }, { status: 401 })
    const response = { status: 201, headers: { 'cache-control': 'private, no-store' } }
    if (request.headers.get('content-type')?.includes('application/json')) {
      const input = await request.json() as { manifest?: unknown }
      const manifest = validateDesignRenderManifest(input.manifest)
      return NextResponse.json({ data: await completeDesignRenderUpload(session.user.id, manifest) }, response)
    }
    const form = await request.formData()
    const manifestValue = form.get('manifest')
    const indexValue = form.get('index')
    const file = form.get('file')
    if (typeof manifestValue !== 'string' || typeof indexValue !== 'string' || !/^\d+$/.test(indexValue) || !(file instanceof File)) throw new UploadValidationError('INVALID_UPLOAD', 'The generated artwork upload is incomplete. Please retry.')
    const manifest = validateDesignRenderManifest(JSON.parse(manifestValue))
    const index = Number(indexValue)
    if (file.size !== designRenderChunkSize(manifest, index)) throw new UploadValidationError('INVALID_UPLOAD', 'The generated artwork upload is incomplete. Please retry.')
    return NextResponse.json({ data: await storeDesignRenderChunk(session.user.id, manifest, index, Buffer.from(await file.arrayBuffer())) }, response)
  } catch (error) {
    if (error instanceof UploadValidationError || error instanceof SvgValidationError) return NextResponse.json({ error: { code: 'INVALID_RENDER', message: friendlyDesignRenderError(error) } }, { status: 400 })
    if (error instanceof R2ConfigurationError) return NextResponse.json({ error: { code: error.code, message: 'Design storage is temporarily unavailable. Your design is still open; retry shortly.' } }, { status: 503 })
    console.error('Generated design upload failed', error)
    return NextResponse.json({ error: { code: 'DESIGN_RENDER_UPLOAD_FAILED', message: friendlyDesignRenderError(error) } }, { status: 502 })
  }
}
