import test from 'node:test'
import assert from 'node:assert/strict'
import { uploadGeneratedDesignAsset } from '../lib/editor/browser-preview'
import { DESIGN_RENDER_CHUNK_BYTES, validateDesignRenderManifest } from '../lib/storage/design-render-uploads'
import { validateUpload } from '../lib/storage/upload-validation'

test('generated previews and production files upload in bounded same-origin authenticated chunks', async () => {
  const blob = new Blob([new Uint8Array(DESIGN_RENDER_CHUNK_BYTES * 2 + 17)], { type: 'application/pdf' })
  let partCount = 0
  const result = await uploadGeneratedDesignAsset(blob, 'front-production.pdf', blob.type, 'design-production', 'draft-123', async (url, init) => {
    assert.equal(url, '/api/uploads/design-render')
    assert.equal(init?.credentials, 'same-origin')
    assert.equal((init?.headers as Record<string, string>)['x-design-render-upload'], '1')
    if (init?.body instanceof FormData) {
      const manifest = validateDesignRenderManifest(JSON.parse(String(init.body.get('manifest'))))
      assert.equal(manifest.designId, 'draft-123')
      const file = init.body.get('file') as File
      assert.ok(file.size <= DESIGN_RENDER_CHUNK_BYTES)
      const index = Number(init.body.get('index'))
      partCount += 1
      return Response.json({ data: { received: index } }, { status: 201 })
    }
    const manifest = validateDesignRenderManifest(JSON.parse(String(init?.body)).manifest)
    return Response.json({ data: { key: `generated/print/user/${manifest.designId}/file.pdf`, size: manifest.size } }, { status: 201 })
  })
  assert.equal(partCount, 3)
  assert.equal(result.size, blob.size)
  assert.match(result.key, /^generated\/print\//)
})

test('browser network failures no longer surface as bare Failed to fetch', async () => {
  await assert.rejects(
    uploadGeneratedDesignAsset(new Blob([new Uint8Array(10)], { type: 'image/png' }), 'front-preview.png', 'image/png', 'design-preview', 'draft-123', async () => { throw new TypeError('Failed to fetch') }),
    (error: Error) => !/Failed to fetch/i.test(error.message) && /generated artwork|connection/i.test(error.message),
  )
})

test('production upload validation allows large generated PDFs but retains the 100 MB limit', () => {
  assert.doesNotThrow(() => validateUpload({ filename: 'production.pdf', contentType: 'application/pdf', size: 50 * 1024 * 1024, purpose: 'design-production' }))
  assert.throws(() => validateUpload({ filename: 'production.pdf', contentType: 'application/pdf', size: 101 * 1024 * 1024, purpose: 'design-production' }), /100 MB/)
})
