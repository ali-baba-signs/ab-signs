import { createCanvas, loadImage } from 'canvas'

type DesignPayload = Record<string, unknown>
type RenderOptions = { side: 'front' | 'back'; widthMm: number; heightMm: number; bleedMm: number; trimMarks: boolean }

function sideJson(payload: DesignPayload, side: 'front' | 'back') {
  const sides = payload.sides && typeof payload.sides === 'object' ? payload.sides as Record<string, unknown> : null
  const selected = sides?.[side]
  if (selected && typeof selected === 'object') {
    const row = selected as Record<string, unknown>
    return (row.canvasJson && typeof row.canvasJson === 'object' ? row.canvasJson : row) as Record<string, unknown>
  }
  if (side === 'back') return null
  return payload.canvasJson && typeof payload.canvasJson === 'object' ? payload.canvasJson as Record<string, unknown> : payload
}

function imagePdf(jpeg: Buffer, pixelWidth: number, pixelHeight: number, pageWidthPt: number, pageHeightPt: number) {
  const content = Buffer.from(`q\n${pageWidthPt.toFixed(3)} 0 0 ${pageHeightPt.toFixed(3)} 0 0 cm\n/Im0 Do\nQ`)
  const objects = [
    Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'),
    Buffer.from('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidthPt.toFixed(3)} ${pageHeightPt.toFixed(3)}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`),
    Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${pixelWidth} /Height ${pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`), jpeg, Buffer.from('\nendstream')]),
    Buffer.concat([Buffer.from(`<< /Length ${content.length} >>\nstream\n`), content, Buffer.from('\nendstream')]),
  ]
  const parts: Buffer[] = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'binary')]
  const offsets = [0]
  let length = parts[0].length
  objects.forEach((object, index) => { offsets.push(length); const part = Buffer.concat([Buffer.from(`${index + 1} 0 obj\n`), object, Buffer.from('\nendobj\n')]); parts.push(part); length += part.length })
  const xref = length
  const table = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  parts.push(Buffer.from(table))
  return Buffer.concat(parts)
}

export async function renderProductionDesign(payload: DesignPayload, options: RenderOptions) {
  const json = sideJson(payload, options.side)
  if (!json) throw new Error('Back artwork has not been created for this double-sided design.')
  const config = payload.productConfig && typeof payload.productConfig === 'object' ? payload.productConfig as Record<string, unknown> : {}
  const logicalWidth = Math.max(100, Math.round(Number(config.logicalCanvasWidth) || 1200))
  const logicalHeight = Math.max(100, Math.round(Number(config.logicalCanvasHeight) || Math.round(logicalWidth * options.heightMm / options.widthMm)))
  const maxPixels = 6500
  const multiplier = Math.max(1, Math.min(5, maxPixels / Math.max(logicalWidth, logicalHeight)))
  const fabric = await import('fabric/node')
  const designCanvas = new fabric.StaticCanvas(undefined, { width: logicalWidth, height: logicalHeight, backgroundColor: '#ffffff' })
  designCanvas.renderOnAddRemove = false
  await designCanvas.loadFromJSON(json)
  for (const object of designCanvas.getObjects()) if ((object as { excludeFromExport?: boolean }).excludeFromExport) designCanvas.remove(object)
  designCanvas.renderAll()
  const trimCanvas = designCanvas.toCanvasElement(multiplier)
  designCanvas.dispose()

  const pxPerMm = Math.min(trimCanvas.width / options.widthMm, trimCanvas.height / options.heightMm)
  const bleedPx = Math.max(0, Math.round(options.bleedMm * pxPerMm))
  const markMarginMm = options.trimMarks ? 7 : 0
  const marginPx = Math.round(markMarginMm * pxPerMm)
  const pageWidth = trimCanvas.width + 2 * (bleedPx + marginPx)
  const pageHeight = trimCanvas.height + 2 * (bleedPx + marginPx)
  const sheet = createCanvas(pageWidth, pageHeight)
  const context = sheet.getContext('2d')
  context.fillStyle = '#ffffff'; context.fillRect(0, 0, pageWidth, pageHeight)
  const image = await loadImage(trimCanvas.toDataURL('image/png'))
  const trimX = bleedPx + marginPx; const trimY = bleedPx + marginPx
  context.drawImage(image, trimX - bleedPx, trimY - bleedPx, trimCanvas.width + bleedPx * 2, trimCanvas.height + bleedPx * 2)
  context.drawImage(image, trimX, trimY, trimCanvas.width, trimCanvas.height)
  if (options.trimMarks) {
    const gap = Math.max(2, Math.round(pxPerMm)); const length = Math.max(8, Math.round(pxPerMm * 5))
    context.strokeStyle = '#000'; context.lineWidth = Math.max(1, pxPerMm * 0.15)
    context.beginPath()
    for (const x of [trimX, trimX + trimCanvas.width]) { context.moveTo(x, trimY - gap); context.lineTo(x, trimY - gap - length); context.moveTo(x, trimY + trimCanvas.height + gap); context.lineTo(x, trimY + trimCanvas.height + gap + length) }
    for (const y of [trimY, trimY + trimCanvas.height]) { context.moveTo(trimX - gap, y); context.lineTo(trimX - gap - length, y); context.moveTo(trimX + trimCanvas.width + gap, y); context.lineTo(trimX + trimCanvas.width + gap + length, y) }
    context.stroke()
  }
  const totalWidthMm = options.widthMm + 2 * (options.bleedMm + markMarginMm)
  const totalHeightMm = options.heightMm + 2 * (options.bleedMm + markMarginMm)
  const jpeg = sheet.toBuffer('image/jpeg', { quality: 0.94, chromaSubsampling: false })
  return {
    preview: sheet.toBuffer('image/png'),
    pdf: imagePdf(jpeg, pageWidth, pageHeight, totalWidthMm / 25.4 * 72, totalHeightMm / 25.4 * 72),
    metadata: { trimWidthMm: options.widthMm, trimHeightMm: options.heightMm, bleedMm: options.bleedMm, trimMarks: options.trimMarks, pixelWidth: pageWidth, pixelHeight: pageHeight, effectiveDpi: Math.round(pxPerMm * 25.4) },
  }
}
