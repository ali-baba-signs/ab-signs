import assert from 'node:assert/strict'
import test from 'node:test'
import { renderProductionDesign } from '../lib/production/design-render'

test('online-editor production renderer creates preview and dimensioned PDF with external trim marks', { timeout: 60000 }, async () => {
  const payload = {
    version: 2,
    productConfig: { logicalCanvasWidth: 400, logicalCanvasHeight: 200 },
    canvasJson: { version: '7.4.0', background: '#ffffff', objects: [{ type: 'Rect', left: 40, top: 30, width: 200, height: 80, fill: '#ed1b68' }] },
    sides: { front: { canvasJson: { version: '7.4.0', background: '#ffffff', objects: [{ type: 'Rect', left: 40, top: 30, width: 200, height: 80, fill: '#ed1b68' }] } } },
  }
  const output = await renderProductionDesign(payload, { side: 'front', widthMm: 1000, heightMm: 500, bleedMm: 3, trimMarks: true })
  assert.equal(output.preview.subarray(1,4).toString(), 'PNG')
  assert.equal(output.pdf.subarray(0,8).toString(), '%PDF-1.4')
  assert.equal(output.metadata.trimWidthMm, 1000)
  assert.equal(output.metadata.bleedMm, 3)
  await assert.rejects(() => renderProductionDesign(payload, { side: 'back', widthMm: 1000, heightMm: 500, bleedMm: 3, trimMarks: true }), /Back artwork/)
})
