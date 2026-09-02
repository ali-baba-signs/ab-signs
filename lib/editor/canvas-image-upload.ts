import { CANVAS_UPLOAD_CHUNK_BYTES, type CanvasUploadManifest } from '@/lib/storage/canvas-uploads'
import { validateUpload } from '@/lib/storage/upload-validation'

/** Same-origin requests retain the current subdomain session and avoid bucket CORS. */
export async function storeCanvasUpload(file: File, fetcher: typeof fetch = fetch) {
  validateUpload({ filename: file.name, contentType: file.type, size: file.size, purpose: 'logo' })
  const send = async (body: FormData | string) => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 60_000)
    try {
      const response = await fetcher('/api/uploads/design-image', {
        method: 'POST', body, credentials: 'same-origin', signal: controller.signal,
        headers: { 'x-canvas-upload': '1', ...(typeof body === 'string' ? { 'content-type': 'application/json' } : {}) },
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error?.message || 'Upload failed. Try again.')
      return payload?.data
    } finally { clearTimeout(timeout) }
  }

  let result: { key?: string } | undefined
  if (file.size <= CANVAS_UPLOAD_CHUNK_BYTES) {
    const form = new FormData()
    form.set('file', file)
    result = await send(form)
  } else {
    const manifest: CanvasUploadManifest = { uploadId: crypto.randomUUID(), filename: file.name, contentType: file.type, size: file.size }
    for (let offset = 0, index = 0; offset < file.size; offset += CANVAS_UPLOAD_CHUNK_BYTES, index += 1) {
      const form = new FormData()
      form.set('manifest', JSON.stringify(manifest))
      form.set('index', String(index))
      form.set('file', file.slice(offset, offset + CANVAS_UPLOAD_CHUNK_BYTES), 'chunk.part')
      const part = await send(form)
      if (part?.received !== index) throw new Error('Upload failed. Try again.')
    }
    result = await send(JSON.stringify({ manifest }))
  }
  if (typeof result?.key !== 'string' || !result.key) throw new Error('Upload failed. Try again.')
  return { key: result.key }
}
