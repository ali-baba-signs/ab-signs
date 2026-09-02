import assert from 'node:assert/strict'
import test from 'node:test'
import { storeCanvasUpload } from '../lib/editor/canvas-image-upload'
import { CANVAS_UPLOAD_CHUNK_BYTES, canvasSessionUploadKeys, canvasUploadChunkSize, cleanupCanvasUploadCandidates, collectCanvasUploadKeys, validateCanvasUploadManifest } from '../lib/storage/canvas-uploads'

test('10 MB uploads stay same-origin and split into five bounded parts before completion', async () => {
  const file = new File([new Uint8Array(10 * 1024 * 1024)], 'large.png', { type: 'image/png' })
  const requests: number[] = []
  let complete = false
  const result = await storeCanvasUpload(file, async (url, init) => {
    assert.equal(url, '/api/uploads/design-image')
    assert.equal(init?.credentials, 'same-origin')
    assert.ok(init?.signal instanceof AbortSignal)
    if (init.body instanceof FormData) {
      const manifest = validateCanvasUploadManifest(JSON.parse(String(init.body.get('manifest'))))
      const index = Number(init.body.get('index'))
      const part = init.body.get('file') as File
      assert.equal(manifest.size, file.size)
      assert.equal(part.size, canvasUploadChunkSize(manifest, index))
      assert.ok(part.size <= CANVAS_UPLOAD_CHUNK_BYTES)
      requests.push(index)
      return Response.json({ data: { received: index } })
    }
    const manifest = validateCanvasUploadManifest(JSON.parse(String(init.body)).manifest)
    assert.equal(manifest.filename, 'large.png')
    complete = true
    return Response.json({ data: { key: 'uploads/users/test/temporary/canvas/large.png' } })
  })
  assert.deepEqual(requests, [0, 1, 2, 3, 4])
  assert.ok(complete)
  assert.equal(result.key, 'uploads/users/test/temporary/canvas/large.png')
})

test('small image uploads need one request, and interrupted chunks never finalize', async () => {
  let count = 0
  await storeCanvasUpload(new File(['image'], 'a.svg', { type: 'image/svg+xml' }), async (_url, init) => {
    count += 1
    assert.ok(init?.body instanceof FormData)
    assert.equal(init.body.get('manifest'), null)
    return Response.json({ data: { key: 'uploads/users/test/temporary/canvas/a.svg' } })
  })
  assert.equal(count, 1)
  count = 0
  await assert.rejects(storeCanvasUpload(new File([new Uint8Array(CANVAS_UPLOAD_CHUNK_BYTES + 1)], 'a.png', { type: 'image/png' }), async (_url, init) => {
    count += 1
    assert.ok(init?.body instanceof FormData)
    return Response.json({ error: { message: 'Upload failed. Try again.' } }, { status: 503 })
  }), /Upload failed/)
  assert.equal(count, 1)
})

test('chunk manifests reject invalid identifiers, oversized totals, types, and part indexes', () => {
  const valid = { uploadId: '04b6a71f-b37d-4812-8038-454215d15941', filename: 'logo.webp', contentType: 'image/webp', size: CANVAS_UPLOAD_CHUNK_BYTES + 7 }
  const manifest = validateCanvasUploadManifest(valid)
  assert.equal(canvasUploadChunkSize(manifest, 0), CANVAS_UPLOAD_CHUNK_BYTES)
  assert.equal(canvasUploadChunkSize(manifest, 1), 7)
  for (const index of [-1, 0.5, 2, NaN]) assert.throws(() => canvasUploadChunkSize(manifest, index))
  assert.throws(() => validateCanvasUploadManifest({ ...valid, uploadId: '../other-user' }))
  assert.throws(() => validateCanvasUploadManifest({ ...valid, size: 10 * 1024 * 1024 + 1 }), /10 MB/)
  assert.throws(() => validateCanvasUploadManifest({ ...valid, filename: 'logo.exe' }), /Unsupported file type/)
  assert.throws(() => validateCanvasUploadManifest({ ...valid, contentType: 'text/html' }), /Unsupported file type/)
})

test('cleanup ownership excludes other users, standalone artwork, and non-session files', () => {
  const key = 'uploads/users/customer/temporary/canvas/logo.png'
  assert.deepEqual(canvasSessionUploadKeys('customer', [key, key,
    'uploads/users/other/temporary/canvas/logo.png',
    'uploads/users/customer/temporary/artwork.pdf',
    'uploads/users/customer/temporary/canvas/nested/logo.png',
    'products/logo.png', null,
  ]), [key])
})

test('cleanup preserves both sides, historical/order references, and failed deletions', async () => {
  const prefix = 'uploads/users/customer/temporary/canvas/'
  const usedKeys = collectCanvasUploadKeys({ front: { assetKey: `${prefix}front.png` }, back: { assetKey: `${prefix}back.svg` }, history: [{ assetKey: `${prefix}old.webp` }] })
  const candidates = ['front.png', 'back.svg', 'old.webp', 'order.png', 'unused.png', 'retry.png'].map((name) => ({ id: name, key: prefix + name }))
  const removed: string[] = []
  const retained: string[] = []
  const failed: string[] = []
  const result = await cleanupCanvasUploadCandidates(candidates, {
    usedKeys,
    isReferenced: async (candidate) => candidate.id === 'order.png',
    preserve: async (candidate) => { retained.push(candidate.id) },
    remove: async (candidate) => {
      if (candidate.id === 'retry.png') throw new Error('Storage unavailable')
      removed.push(candidate.id)
    },
    failed: (candidate) => { failed.push(candidate.id) },
  })
  assert.deepEqual(retained, ['front.png', 'back.svg', 'old.webp', 'order.png'])
  assert.deepEqual(removed, ['unused.png'])
  assert.deepEqual(failed, ['retry.png'])
  assert.equal(result.deleted, 1)
  assert.equal(result.preserved, 4)
  assert.deepEqual(result.deletedKeys, [prefix + 'unused.png'])
})
