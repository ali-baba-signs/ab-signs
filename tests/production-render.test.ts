import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { renderProductionJpeg } from '../lib/production/design-render'

test('browser JPEG is packaged into a dimensioned production PDF without native canvas', async () => {
  const jpeg = await readFile(new URL('../public/placeholder.jpg', import.meta.url))
  const output = renderProductionJpeg(jpeg, { widthMm: 1000, heightMm: 500, bleedMm: 3, trimMarks: true })
  assert.equal(output.pdf.subarray(0,8).toString(), '%PDF-1.4')
  assert.equal(output.metadata.trimWidthMm, 1000)
  assert.equal(output.metadata.bleedMm, 3)
  assert.ok(output.metadata.pixelWidth > 0)
  assert.ok(output.metadata.pixelHeight > 0)
  assert.throws(() => renderProductionJpeg(Buffer.from('not a jpeg'), { widthMm: 1000, heightMm: 500, bleedMm: 3, trimMarks: true }), /valid JPEG/)
})
