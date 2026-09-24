import assert from 'node:assert/strict'
import test from 'node:test'
import { cropMarkPath, millimetres, printGeometry } from '../lib/production/print-settings'
import { buildPrintReadyPdf } from '../lib/pdf/print-ready-core'
import { designToSvg } from '../lib/production/design-svg'

test('A4 trim, bleed, safe area and PDF page boxes use physical millimetres', () => {
  const layout = printGeometry(210, 297)
  assert.deepEqual([layout.bleedWidthMm, layout.bleedHeightMm, layout.safeWidthMm, layout.safeHeightMm], [216, 303, 200, 287])
  const pdf = Buffer.from(buildPrintReadyPdf(Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]), { widthMm: 210, heightMm: 297, bleedMm: 3, trimMarks: true, jpegWidth: 1, jpegHeight: 1 })).toString('latin1')
  const trim = pdf.match(/\/TrimBox \[([^\]]+)\]/)?.[1].split(' ').map(Number)
  const bleed = pdf.match(/\/BleedBox \[([^\]]+)\]/)?.[1].split(' ').map(Number)
  assert.ok(trim && bleed)
  assert.ok(bleed[0] < trim[0] && bleed[1] < trim[1] && bleed[2] > trim[2] && bleed[3] > trim[3])
  assert.ok(Math.abs((bleed[2] - bleed[0]) * 25.4 / 72 - 216) < 0.01)
  assert.match(pdf, / re W n\n/)
})

test('500 mm custom trim uses 506 mm bleed canvas, 490 mm safe area, and outer crop marks', () => {
  const size = millimetres('500', 'mm')
  const layout = printGeometry(size, size)
  assert.deepEqual([layout.bleedWidthMm, layout.bleedHeightMm, layout.safeWidthMm, layout.safeHeightMm], [506, 506, 490, 490])
  const path = cropMarkPath(11, 11, 500, 500, 3, 3, 1, 1)
  assert.match(path, /^M1\.5 11H6\.5/)
  assert.ok(6.5 < 8) // Bleed begins at x=8; marks end outside it.
})

test('unit conversion keeps physical trim dimensions consistent', () => {
  assert.equal(millimetres('21', 'cm'), 210)
  assert.equal(millimetres('8.26771653543307', 'in').toFixed(3), '210.000')
  assert.throws(() => printGeometry(5, 5), /Safe margin/)
})

test('production profiles control bleed and crop marks independently', () => {
  const rigid = designToSvg({ productConfig: { widthMm: 500, heightMm: 500, bleedMm: 2, safeMarginMm: 5, trimMarks: true, logicalCanvasWidth: 500, logicalCanvasHeight: 500 }, canvasJson: { objects: [{ type: 'rect', width: 500, height: 500, fill: '#fff' }] } })
  const banner = designToSvg({ productConfig: { widthMm: 500, heightMm: 500, bleedMm: 10, safeMarginMm: 25, trimMarks: false, logicalCanvasWidth: 500, logicalCanvasHeight: 500 }, canvasJson: { objects: [{ type: 'rect', width: 500, height: 500, fill: '#fff' }] } })
  assert.match(rigid, /data-trim-width-mm="500"/)
  assert.match(rigid, /id="crop-marks"/)
  assert.doesNotMatch(banner, /id="crop-marks"/)
  assert.match(banner, /width="520mm" height="520mm"/)
  const pdf = Buffer.from(buildPrintReadyPdf(Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]), { widthMm: 500, heightMm: 500, bleedMm: 10, trimMarks: false, jpegWidth: 1, jpegHeight: 1 })).toString('latin1')
  assert.doesNotMatch(pdf, /0 G\n/)
  assert.match(pdf, /\/BleedBox \[/)
})

test('legacy SVG export rejects non-embedded images instead of silently omitting artwork', () => {
  assert.throws(() => designToSvg({ productConfig: { widthMm: 210, heightMm: 297, logicalCanvasWidth: 210, logicalCanvasHeight: 297 }, canvasJson: { objects: [{ type: 'rect', width: 210, height: 297, fill: '#fff' }, { type: 'image', src: 'https://example.com/remote.png', width: 10, height: 10 }] } }), /not embedded/)
  const svg = designToSvg({ productConfig: { widthMm: 210, heightMm: 297, logicalCanvasWidth: 210, logicalCanvasHeight: 297 }, canvasJson: { objects: [{ type: 'rect', width: 210, height: 297, fill: '#fff' }] } })
  assert.doesNotMatch(svg, /id="cut-line"|id="bleed-boundary"/)
})
