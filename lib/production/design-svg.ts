type Json = Record<string, unknown>

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
  return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="${background}"/>${body}</svg>`
}
