'use client'

export interface UploadedAsset { id: string; key: string; url: string; filename: string; contentType: string; size: number; checksum?: string }

export function uploadAdminFile(file: File, purpose: 'product-image' | 'template' | 'homepage' | 'offer-image' | 'order-document', destination: string, onProgress?: (percent: number) => void) {
  return new Promise<UploadedAsset>((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('POST', '/api/admin/uploads')
    request.responseType = 'json'
    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress?.(Math.round(event.loaded / event.total * 100))
    })
    request.addEventListener('load', () => {
      const payload = request.response
      if (request.status >= 200 && request.status < 300 && payload?.data) resolve(payload.data)
      else reject(new Error(payload?.error?.message || 'The upload failed.'))
    })
    request.addEventListener('error', () => reject(new Error('The upload connection failed. Check your network and storage configuration.')))
    request.addEventListener('abort', () => reject(new Error('The upload was cancelled.')))
    request.addEventListener('timeout', () => reject(new Error('The upload timed out.')))
    request.timeout = 120000
    const form = new FormData()
    form.set('file', file)
    form.set('purpose', purpose)
    form.set('destination', destination)
    request.send(form)
  })
}

export async function removeAdminUpload(key: string) {
  const response = await fetch('/api/admin/uploads', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key }) })
  if (!response.ok) throw new Error((await response.json()).error?.message || 'The uploaded file could not be removed.')
}
