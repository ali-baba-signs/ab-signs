import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { getSession } from '@/lib/auth/middleware'
import { designRenderChunkSize, friendlyDesignRenderError, validateDesignRenderManifest } from '@/lib/storage/design-render-uploads'
import { completeDesignRenderUpload, storeDesignRenderChunk } from '@/lib/storage/design-render-storage'
import { R2ConfigurationError } from '@/lib/storage/r2'
import { UploadValidationError } from '@/lib/storage/upload-validation'
import { SvgValidationError } from '@/lib/templates/svg-sanitization'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const requestId = randomUUID()
  let stage = 'authorization'
  try {
    if (request.headers.get('x-design-render-upload') !== '1') return NextResponse.json({ error: { code: 'UPLOAD_FORBIDDEN', message: 'The generated artwork upload could not be authorized.', requestId } }, { status: 403 })
    stage = 'authentication'
    const session = await getSession(request)
    if (!session?.user) return NextResponse.json({ error: { code: 'UPLOAD_NOT_AUTHORIZED', message: 'Your session expired. Sign in again, then retry saving the design.', requestId } }, { status: 401 })
    const response = { status: 201, headers: { 'cache-control': 'private, no-store', 'x-request-id': requestId } }
    if (request.headers.get('content-type')?.includes('application/json')) {
      stage = 'storage-completion'
      const input = await request.json() as { manifest?: unknown }
      const manifest = validateDesignRenderManifest(input.manifest)
      return NextResponse.json({ data: await completeDesignRenderUpload(session.user.id, manifest) }, response)
    }
    stage = 'storage-chunk'
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
    const details = error as { name?: unknown; code?: unknown; message?: unknown; stack?: unknown; $metadata?: { httpStatusCode?: number } }
    console.error('Generated design upload failed', { requestId, stage, name: details?.name, code: details?.code, status: details?.$metadata?.httpStatusCode, message: details?.message, stack: details?.stack })
    if (error instanceof SvgValidationError) return NextResponse.json({ error: { code: 'INVALID_RENDER', message: 'Your design preview could not be generated. Please retry.', requestId } }, { status: 400 })
    if (error instanceof UploadValidationError) return NextResponse.json({ error: { code: 'INVALID_RENDER', message: friendlyDesignRenderError(error), requestId } }, { status: 400 })
    if (error instanceof R2ConfigurationError) return NextResponse.json({ error: { code: error.code, message: `Design storage is not configured for this environment. Your design is still open. Reference: ${requestId}.`, requestId } }, { status: 503 })
    if (stage === 'authentication') return NextResponse.json({ error: { code: 'AUTH_SESSION_CHECK_FAILED', message: `Your session could not be checked because authentication storage failed. Your design is still open. Reference: ${requestId}.`, requestId } }, { status: 503 })
    return NextResponse.json({ error: { code: 'DESIGN_STORAGE_FAILED', message: `Cloudflare R2 did not complete the generated artwork upload. Your design is still open; retry shortly. Reference: ${requestId}.`, requestId } }, { status: 502 })
  }
}
