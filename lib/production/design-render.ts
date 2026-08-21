type RenderOptions = {
  widthMm: number
  heightMm: number
  bleedMm: number
  trimMarks: boolean
}

const POINTS_PER_MM = 72 / 25.4

function jpegDimensions(jpeg: Buffer) {
  if (jpeg.length < 4 || jpeg[0] !== 0xff || jpeg[1] !== 0xd8) {
    throw new Error('The browser production render is not a valid JPEG image.')
  }

  const startOfFrame = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf])
  let offset = 2
  while (offset + 3 < jpeg.length) {
    if (jpeg[offset] !== 0xff) { offset += 1; continue }
    while (jpeg[offset] === 0xff) offset += 1
    const marker = jpeg[offset]
    offset += 1
    if (marker === 0xd8 || marker === 0xd9) continue
    if (marker === 0xda) break
    if (offset + 1 >= jpeg.length) break
    const length = jpeg.readUInt16BE(offset)
    if (length < 2 || offset + length > jpeg.length) break
    if (startOfFrame.has(marker) && length >= 8) {
      const height = jpeg.readUInt16BE(offset + 3)
      const width = jpeg.readUInt16BE(offset + 5)
      const components = jpeg[offset + 7]
      if (!(width > 0 && height > 0) || ![1, 3].includes(components)) {
        throw new Error('The browser production render uses unsupported JPEG dimensions or color data.')
      }
      return { width, height, components }
    }
    offset += length
  }
  throw new Error('The browser production render does not contain JPEG dimensions.')
}

function pdfLine(value: number) {
  return Number(value.toFixed(3))
}

function trimMarkCommands(trimX: number, trimY: number, trimWidth: number, trimHeight: number) {
  const gap = 1 * POINTS_PER_MM
  const length = 5 * POINTS_PER_MM
  const right = trimX + trimWidth
  const top = trimY + trimHeight
  return [
    `${pdfLine(trimX)} ${pdfLine(trimY - gap)} m ${pdfLine(trimX)} ${pdfLine(trimY - gap - length)} l`,
    `${pdfLine(right)} ${pdfLine(trimY - gap)} m ${pdfLine(right)} ${pdfLine(trimY - gap - length)} l`,
    `${pdfLine(trimX)} ${pdfLine(top + gap)} m ${pdfLine(trimX)} ${pdfLine(top + gap + length)} l`,
    `${pdfLine(right)} ${pdfLine(top + gap)} m ${pdfLine(right)} ${pdfLine(top + gap + length)} l`,
    `${pdfLine(trimX - gap)} ${pdfLine(trimY)} m ${pdfLine(trimX - gap - length)} ${pdfLine(trimY)} l`,
    `${pdfLine(trimX - gap)} ${pdfLine(top)} m ${pdfLine(trimX - gap - length)} ${pdfLine(top)} l`,
    `${pdfLine(right + gap)} ${pdfLine(trimY)} m ${pdfLine(right + gap + length)} ${pdfLine(trimY)} l`,
    `${pdfLine(right + gap)} ${pdfLine(top)} m ${pdfLine(right + gap + length)} ${pdfLine(top)} l`,
  ]
}

/**
 * Packages a browser-rendered JPEG into a dimensioned production PDF without
 * loading or rasterizing the design on the server. This is Buffer-only code and
 * has no native binary dependency.
 */
export function renderProductionJpeg(jpeg: Buffer, options: RenderOptions) {
  if (!(options.widthMm > 0 && options.heightMm > 0)) throw new Error('Production dimensions must be positive.')
  if (!(options.bleedMm >= 0 && Number.isFinite(options.bleedMm))) throw new Error('Production bleed must be zero or greater.')
  const image = jpegDimensions(jpeg)
  const markMarginMm = options.trimMarks ? 7 : 0
  const trimWidth = options.widthMm * POINTS_PER_MM
  const trimHeight = options.heightMm * POINTS_PER_MM
  const bleed = options.bleedMm * POINTS_PER_MM
  const margin = markMarginMm * POINTS_PER_MM
  const pageWidth = trimWidth + 2 * (bleed + margin)
  const pageHeight = trimHeight + 2 * (bleed + margin)
  const trimX = bleed + margin
  const trimY = bleed + margin

  const commands = [
    'q',
    '1 1 1 rg',
    `0 0 ${pdfLine(pageWidth)} ${pdfLine(pageHeight)} re f`,
    'Q',
    `q ${pdfLine(trimWidth + 2 * bleed)} 0 0 ${pdfLine(trimHeight + 2 * bleed)} ${pdfLine(margin)} ${pdfLine(margin)} cm /Im0 Do Q`,
    `q ${pdfLine(trimWidth)} 0 0 ${pdfLine(trimHeight)} ${pdfLine(trimX)} ${pdfLine(trimY)} cm /Im0 Do Q`,
  ]
  if (options.trimMarks) commands.push('0 0 0 RG', `${pdfLine(0.15 * POINTS_PER_MM)} w`, ...trimMarkCommands(trimX, trimY, trimWidth, trimHeight), 'S')
  const content = Buffer.from(commands.join('\n'))
  const colorSpace = image.components === 1 ? '/DeviceGray' : '/DeviceRGB'
  const objects = [
    Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'),
    Buffer.from('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pdfLine(pageWidth)} ${pdfLine(pageHeight)}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`),
    Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace ${colorSpace} /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`), jpeg, Buffer.from('\nendstream')]),
    Buffer.concat([Buffer.from(`<< /Length ${content.length} >>\nstream\n`), content, Buffer.from('\nendstream')]),
  ]
  const parts: Buffer[] = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'binary')]
  const offsets = [0]
  let byteLength = parts[0].length
  objects.forEach((object, index) => {
    offsets.push(byteLength)
    const part = Buffer.concat([Buffer.from(`${index + 1} 0 obj\n`), object, Buffer.from('\nendobj\n')])
    parts.push(part)
    byteLength += part.length
  })
  const xref = byteLength
  parts.push(Buffer.from(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`))

  const pxPerMm = Math.min(image.width / options.widthMm, image.height / options.heightMm)
  return {
    pdf: Buffer.concat(parts),
    metadata: {
      trimWidthMm: options.widthMm,
      trimHeightMm: options.heightMm,
      bleedMm: options.bleedMm,
      trimMarks: options.trimMarks,
      pixelWidth: image.width,
      pixelHeight: image.height,
      effectiveDpi: Math.round(pxPerMm * 25.4),
    },
  }
}
