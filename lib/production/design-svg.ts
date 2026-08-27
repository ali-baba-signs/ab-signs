type Json = Record<string, unknown>
import type { ProductConfig } from '@/lib/editor/types'
import { productionMetadata, productionSpec } from './production-spec'

function n(value: unknown, fallback = 0) { const result = Number(value); return Number.isFinite(result) ? result : fallback }
function xml(value: unknown) { return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]!) }
function color(value: unknown, fallback = 'none') { return typeof value === 'string' && value.length <= 200 ? xml(value) : fallback }
function paint(object: Json) {
  const opacity = Math.max(0, Math.min(1, n(object.opacity, 1)))
  const strokeWidth = Math.max(0, n(object.strokeWidth))
  return `fill="${color(object.fill)}" stroke="${color(object.stroke)}" stroke-width="${strokeWidth}" opacity="${opacity}"`
}
function originOffset(object: Json) {
  const width = n(object.width), height = n(object.height)
  const x = object.originX === 'center' ? -width / 2 : object.originX === 'right' ? -width : 0
  const y = object.originY === 'center' ? -height / 2 : object.originY === 'bottom' ? -height : 0
  return { x, y, width, height }
}
function transform(object: Json) {
  const flipX = object.flipX === true ? -1 : 1, flipY = object.flipY === true ? -1 : 1
  return `translate(${n(object.left)} ${n(object.top)}) rotate(${n(object.angle)}) scale(${n(object.scaleX, 1) * flipX} ${n(object.scaleY, 1) * flipY}) skewX(${n(object.skewX)}) skewY(${n(object.skewY)})`
}
function pathData(value: unknown) {
  if (!Array.isArray(value)) return ''
  return value.map((segment) => Array.isArray(segment) ? segment.map((part, index) => index ? n(part) : String(part).replace(/[^a-z]/gi, '')).join(' ') : '').join(' ')
}
function renderObject(value: unknown): string {
  if (!value || typeof value !== 'object') return ''
  const object = value as Json
  if (object.visible === false || object.excludeFromExport === true) return ''
  const type = String(object.type || '').toLowerCase()
  const box = originOffset(object)
  let shape = ''
  if (type === 'rect') shape = `<rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" rx="${n(object.rx)}" ry="${n(object.ry)}" ${paint(object)}/>`
  else if (type === 'circle') { const radius = n(object.radius); shape = `<circle cx="${box.x + radius}" cy="${box.y + radius}" r="${radius}" ${paint(object)}/>` }
  else if (type === 'ellipse') shape = `<ellipse cx="${box.x + n(object.rx)}" cy="${box.y + n(object.ry)}" rx="${n(object.rx)}" ry="${n(object.ry)}" ${paint(object)}/>`
  else if (type === 'line') { const points = Array.isArray(object.points) ? object.points.map((point) => n(point)) : [n(object.x1), n(object.y1), n(object.x2), n(object.y2)]; shape = `<line x1="${points[0]}" y1="${points[1]}" x2="${points[2]}" y2="${points[3]}" ${paint(object)}/>` }
  else if (type === 'path') { const offset = object.pathOffset && typeof object.pathOffset === 'object' ? object.pathOffset as Json : {}; shape = `<path d="${xml(pathData(object.path))}" transform="translate(${-n(offset.x)} ${-n(offset.y)})" ${paint(object)}/>` }
  else if (['text', 'i-text', 'textbox'].includes(type)) {
    const fontSize = Math.max(1, n(object.fontSize, 40)), lineHeight = Math.max(.5, n(object.lineHeight, 1.16)) * fontSize
    const lines = String(object.text ?? '').split(/\r?\n/)
    const anchor = object.textAlign === 'center' ? 'middle' : object.textAlign === 'right' || object.textAlign === 'end' ? 'end' : 'start'
    const x = anchor === 'middle' ? box.x + box.width / 2 : anchor === 'end' ? box.x + box.width : box.x
    shape = `<text x="${x}" y="${box.y + fontSize}" fill="${color(object.fill, '#000')}" opacity="${Math.max(0, Math.min(1, n(object.opacity, 1)))}" font-family="${xml(object.fontFamily || 'sans-serif')}" font-size="${fontSize}" font-weight="${xml(object.fontWeight || 'normal')}" font-style="${xml(object.fontStyle || 'normal')}" text-anchor="${anchor}">${lines.map((line, index) => `<tspan x="${x}" dy="${index ? lineHeight : 0}">${xml(line)}</tspan>`).join('')}</text>`
  } else if (type === 'image') {
    const source = typeof object.src === 'string' && /^(https:\/\/|data:image\/(?:png|jpeg|webp);base64,)/i.test(object.src) ? object.src : ''
    if (source) shape = `<image href="${xml(source)}" x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" preserveAspectRatio="none" opacity="${Math.max(0, Math.min(1, n(object.opacity, 1)))}"/>`
  } else if (type === 'group' && Array.isArray(object.objects)) shape = object.objects.map(renderObject).join('')
  return shape ? `<g transform="${transform(object)}">${shape}</g>` : ''
}

function sideCanvas(canvasData: Json, side: 'front' | 'back') {
  const sides = canvasData.sides && typeof canvasData.sides === 'object' ? canvasData.sides as Json : null
  const selected = sides?.[side] && typeof sides[side] === 'object' ? sides[side] as Json : null
  const nested = selected?.canvasJson && typeof selected.canvasJson === 'object' ? selected.canvasJson as Json : null
  return nested || (canvasData.canvasJson && typeof canvasData.canvasJson === 'object' ? canvasData.canvasJson as Json : null)
}

export function designToSvg(canvasData: unknown, side: 'front' | 'back' = 'front') {
  if (!canvasData || typeof canvasData !== 'object') throw new Error('The canonical design data is missing.')
  const root = canvasData as Json
  const canvas = sideCanvas(root, side)
  if (!canvas) throw new Error(`The ${side} canvas data is missing.`)
  const config = root.productConfig && typeof root.productConfig === 'object' ? root.productConfig as Json : {}
  const width = Math.max(1, n(canvas.width, n(config.logicalCanvasWidth)))
  const height = Math.max(1, n(canvas.height, n(config.logicalCanvasHeight)))
  if (!(width > 1 && height > 1 && width <= 100000 && height <= 100000)) throw new Error('The canonical canvas dimensions are invalid.')
  const objects = Array.isArray(canvas.objects) ? canvas.objects : []
  const background = typeof canvas.background === 'string' || typeof canvas.backgroundColor === 'string' ? color(canvas.background || canvas.backgroundColor, 'transparent') : 'transparent'
  const body = objects.map(renderObject).join('')
  if (!body) throw new Error(`The ${side} canvas has no exportable design objects.`)
  const productConfig: ProductConfig = {
    widthMm: Math.max(.1, n(config.widthMm, width)), heightMm: Math.max(.1, n(config.heightMm, height)),
    bleedMm: Math.max(0, n(config.bleedMm, 3)), safeMarginMm: Math.max(0, n(config.safeMarginMm)),
    logicalCanvasWidth: width, logicalCanvasHeight: height, trimMarks: config.trimMarks !== false,
    productCategory: config.productCategory === 'flag' ? 'flag' : 'banner',
  }
  const spec = productionSpec(productConfig), scaleX = width / spec.trimWidthMm, scaleY = height / spec.trimHeightMm
  const trimLeft = (spec.markMarginMm + spec.bleedMm) * scaleX, trimTop = (spec.markMarginMm + spec.bleedMm) * scaleY
  const pageWidth = spec.pageWidthMm * scaleX, pageHeight = spec.pageHeightMm * scaleY
  const fixedLayer = objects.find((value) => value && typeof value === 'object' && (value as Json).role === 'fixed-product-layer')
  if (spec.productKind === 'flag' && !fixedLayer) throw new Error('The saved flag design has no fixed silhouette contour.')
  const contour = fixedLayer ? renderObject(fixedLayer) : ''
  const guideStyle = `<style>.production-mask *{fill:#fff!important;stroke:none!important}.production-bleed *{fill:none!important;stroke:#ec008c!important;stroke-width:0.25mm!important;stroke-dasharray:4mm 2mm!important;vector-effect:non-scaling-stroke}.production-cut *{fill:none!important;stroke:#111!important;stroke-width:0.25mm!important;vector-effect:non-scaling-stroke}.production-safety *{fill:none!important;stroke:#00a651!important;stroke-width:0.25mm!important;stroke-dasharray:4mm 2mm!important;vector-effect:non-scaling-stroke}</style>`
  const translatedArtwork = `<g id="artwork"${spec.productKind === 'flag' ? ' mask="url(#production-flag-mask)"' : ''}><g transform="translate(${trimLeft} ${trimTop})"><rect width="${width}" height="${height}" fill="${background}"/>${body}</g></g>`
  let guides = ''
  if (spec.productKind === 'flag') {
    const outerX = (spec.trimWidthMm + spec.bleedMm * 2) / spec.trimWidthMm, outerY = (spec.trimHeightMm + spec.bleedMm * 2) / spec.trimHeightMm
    const safetyX = Math.max(.05, (spec.trimWidthMm - spec.safetyMm * 2) / spec.trimWidthMm), safetyY = Math.max(.05, (spec.trimHeightMm - spec.safetyMm * 2) / spec.trimHeightMm)
    const transformFor = (x: number, y: number) => `translate(${trimLeft} ${trimTop}) translate(${width / 2} ${height / 2}) scale(${x} ${y}) translate(${-width / 2} ${-height / 2})`
    guides = `<g id="bleed-contour" class="production-bleed" transform="${transformFor(outerX, outerY)}">${contour}</g><g id="cut-contour" class="production-cut" transform="${transformFor(1, 1)}">${contour}</g><g id="safety-contour" class="production-safety" transform="${transformFor(safetyX, safetyY)}">${contour}</g>`
  } else {
    const bleedX = spec.markMarginMm * scaleX, bleedY = spec.markMarginMm * scaleY, safeX = spec.safetyMm * scaleX, safeY = spec.safetyMm * scaleY
    guides = `<g id="bleed-boundary" class="production-bleed"><rect x="${bleedX}" y="${bleedY}" width="${(spec.trimWidthMm + spec.bleedMm * 2) * scaleX}" height="${(spec.trimHeightMm + spec.bleedMm * 2) * scaleY}"/></g><g id="cut-line" class="production-cut"><rect x="${trimLeft}" y="${trimTop}" width="${width}" height="${height}"/></g><g id="safety-margin" class="production-safety"><rect x="${trimLeft + safeX}" y="${trimTop + safeY}" width="${Math.max(1, width - safeX * 2)}" height="${Math.max(1, height - safeY * 2)}"/></g>`
  }
  const gapX = 1.5 * scaleX, gapY = 1.5 * scaleY, lengthX = 5 * scaleX, lengthY = 5 * scaleY, right = trimLeft + width, bottom = trimTop + height
  const crops = spec.cropMarks ? `<g id="crop-marks" fill="none" stroke="#111" stroke-width="0.25mm" vector-effect="non-scaling-stroke"><path d="M${trimLeft-gapX-lengthX} ${trimTop}H${trimLeft-gapX} M${trimLeft} ${trimTop-gapY-lengthY}V${trimTop-gapY} M${right+gapX} ${trimTop}H${right+gapX+lengthX} M${right} ${trimTop-gapY-lengthY}V${trimTop-gapY} M${trimLeft-gapX-lengthX} ${bottom}H${trimLeft-gapX} M${trimLeft} ${bottom+gapY}V${bottom+gapY+lengthY} M${right+gapX} ${bottom}H${right+gapX+lengthX} M${right} ${bottom+gapY}V${bottom+gapY+lengthY}"/></g>` : ''
  const metadata = xml(JSON.stringify(productionMetadata(productConfig)))
  const definitions = spec.productKind === 'flag' ? `<defs>${guideStyle}<mask id="production-flag-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="${pageWidth}" height="${pageHeight}"><rect width="${pageWidth}" height="${pageHeight}" fill="#000"/><g class="production-mask" transform="translate(${trimLeft} ${trimTop})">${contour}</g></mask></defs>` : `<defs>${guideStyle}</defs>`
  return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${spec.pageWidthMm}mm" height="${spec.pageHeightMm}mm" viewBox="0 0 ${pageWidth} ${pageHeight}" data-trim-width-mm="${spec.trimWidthMm}" data-trim-height-mm="${spec.trimHeightMm}"><title>Ali Baba Signs production artwork</title><desc>Print-ready artwork with bleed, cut contour, safety contour, crop marks, and exact physical dimensions.</desc><metadata id="alibaba-signs-production">${metadata}</metadata>${definitions}<rect width="100%" height="100%" fill="#fff"/>${translatedArtwork}${guides}${crops}</svg>`
}
