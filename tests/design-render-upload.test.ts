import test from 'node:test'
import assert from 'node:assert/strict'
import { uploadGeneratedDesignAsset } from '../lib/editor/browser-preview'
import { DESIGN_RENDER_CHUNK_BYTES, validateDesignRenderManifest } from '../lib/storage/design-render-uploads'
import { validateUpload } from '../lib/storage/upload-validation'
import { ensureCompleteGeneratedSvg, prepareCanvasJsonForExport } from '../lib/editor/svg-export'
import { friendlyDesignRenderError } from '../lib/storage/design-render-uploads'

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

test('generated SVG must be a complete, explicitly sized document before upload', async () => {
  const complete = ensureCompleteGeneratedSvg('<svg xmlns="http://www.w3.org/2000/svg"><text>Test</text></svg>', '210mm', '297mm')
  assert.match(complete, /^<svg\b/)
  assert.match(complete, /width="210mm"/)
  assert.match(complete, /height="297mm"/)
  assert.match(complete, /<\/svg>$/)
  assert.throws(() => ensureCompleteGeneratedSvg('<?xml version="1.0"?><!DOCTYPE svg><svg></svg>', '10', '10'), /incomplete SVG/i)
  assert.throws(() => ensureCompleteGeneratedSvg('<g><text>fragment</text></g>', '10', '10'), /incomplete SVG/i)
  assert.throws(() => ensureCompleteGeneratedSvg('<svg><text>truncated</text>', '10', '10'), /incomplete SVG/i)
  await assert.rejects(
    uploadGeneratedDesignAsset(new Blob(['<svg><text>truncated</text>'], { type: 'image/svg+xml' }), 'front-production.svg', 'image/svg+xml', 'design-production', 'draft-123', async () => Response.json({})),
    /Your design preview could not be generated\. Please retry\./,
  )
  assert.equal(friendlyDesignRenderError(new Error('The generated SVG closing tag is missing.')), 'Your design preview could not be generated. Please retry.')
})

test('Fabric export embeds blob and network image sources while retaining transforms and sides', async () => {
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
  const fetcher = (async () => new Response(png, { headers: { 'content-type': 'image/png' } })) as typeof fetch
  const front = await prepareCanvasJsonForExport({ objects: [
    { type: 'textbox', text: 'Front' },
    { type: 'image', src: 'blob:front-image', angle: 35 },
    { type: 'group', objects: [{ type: 'image', src: 'https://assets.example.test/logo.png' }] },
  ] }, fetcher)
  const back = await prepareCanvasJsonForExport({ objects: [{ type: 'image', src: 'data:image/png;base64,iVBORw0KGgo=', angle: -15 }] }, fetcher)
  const frontObjects = front.objects as Array<Record<string, unknown>>
  assert.match(String(frontObjects[1].src), /^data:image\/png;base64,/) // PNG upload
  assert.equal(frontObjects[1].angle, 35) // rotated image
  assert.match(String(((frontObjects[2].objects as Array<Record<string, unknown>>)[0]).src), /^data:image\/png;base64,/) // nested SVG/image object
  assert.equal(((back.objects as Array<Record<string, unknown>>)[0]).angle, -15) // second side
})
