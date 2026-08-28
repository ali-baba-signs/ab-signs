export interface PrintPdfOptions { widthMm: number; heightMm: number; bleedMm: number; safetyMm?: number; productKind?: 'rectangle' | 'flag'; trimMarks: boolean; jpegWidth: number; jpegHeight: number; title?: string; renderedPageWidthMm?: number; renderedPageHeightMm?: number }
const encoder = new TextEncoder()
const ascii = (value: string) => encoder.encode(value)
const pt = (mm: number) => mm * 72 / 25.4
const fixed = (value: number) => Number(value.toFixed(4))
const escapePdf = (value: string) => value.replace(/[\\()]/g, '\\$&').replace(/[^\x20-\x7e]/g, '?')

export function buildPrintReadyPdf(jpeg: Uint8Array, options: PrintPdfOptions) {
  if (!jpeg.length || jpeg[0] !== 0xff || jpeg[1] !== 0xd8) throw new Error('The print render is not a valid JPEG image.')
  if (!(options.widthMm > 0 && options.heightMm > 0 && options.jpegWidth > 0 && options.jpegHeight > 0)) throw new Error('Print PDF dimensions are invalid.')
  const bleed = Math.max(0, options.bleedMm), markMargin = options.trimMarks ? Math.max(8, bleed + 5) : 0
  const renderedPage = Number(options.renderedPageWidthMm) > 0 && Number(options.renderedPageHeightMm) > 0
  const pageWidthMm = renderedPage ? Number(options.renderedPageWidthMm) : options.widthMm + bleed * 2 + markMargin * 2
  const pageHeightMm = renderedPage ? Number(options.renderedPageHeightMm) : options.heightMm + bleed * 2 + markMargin * 2
  const pageWidthPt = pt(pageWidthMm), pageHeightPt = pt(pageHeightMm)
  const userUnit = Math.max(1, Math.ceil(Math.max(pageWidthPt, pageHeightPt) / 14000))
  const pageWidth = fixed(pageWidthPt / userUnit), pageHeight = fixed(pageHeightPt / userUnit)
  const imageX = renderedPage ? 0 : fixed(pt(markMargin) / userUnit), imageY = renderedPage ? 0 : fixed(pt(markMargin) / userUnit)
  const imageWidth = renderedPage ? pageWidth : fixed(pt(options.widthMm + bleed * 2) / userUnit), imageHeight = renderedPage ? pageHeight : fixed(pt(options.heightMm + bleed * 2) / userUnit)
  const trimLeft = fixed(pt(markMargin + bleed) / userUnit), trimBottom = fixed(pt(markMargin + bleed) / userUnit)
  const trimRight = fixed(trimLeft + pt(options.widthMm) / userUnit), trimTop = fixed(trimBottom + pt(options.heightMm) / userUnit)
  const markLength = fixed(pt(5) / userUnit), markGap = fixed(pt(1.5) / userUnit)
  const marks = options.trimMarks && !renderedPage ? [
    `${fixed(trimLeft-markGap-markLength)} ${trimBottom} m ${fixed(trimLeft-markGap)} ${trimBottom} l`, `${trimLeft} ${fixed(trimBottom-markGap-markLength)} m ${trimLeft} ${fixed(trimBottom-markGap)} l`,
    `${fixed(trimRight+markGap)} ${trimBottom} m ${fixed(trimRight+markGap+markLength)} ${trimBottom} l`, `${trimRight} ${fixed(trimBottom-markGap-markLength)} m ${trimRight} ${fixed(trimBottom-markGap)} l`,
    `${fixed(trimLeft-markGap-markLength)} ${trimTop} m ${fixed(trimLeft-markGap)} ${trimTop} l`, `${trimLeft} ${fixed(trimTop+markGap)} m ${trimLeft} ${fixed(trimTop+markGap+markLength)} l`,
    `${fixed(trimRight+markGap)} ${trimTop} m ${fixed(trimRight+markGap+markLength)} ${trimTop} l`, `${trimRight} ${fixed(trimTop+markGap)} m ${trimRight} ${fixed(trimTop+markGap+markLength)} l`,
  ].join('\n') : ''
  const content = `q\n${imageWidth} 0 0 ${imageHeight} ${imageX} ${imageY} cm\n/Artwork Do\nQ\n${marks ? `q\n0 G\n${fixed(0.25/userUnit)} w\n${marks}\nS\nQ\n` : ''}`
  const objects: Uint8Array[] = [
    ascii('<< /Type /Catalog /Pages 2 0 R >>'), ascii('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    ascii(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /UserUnit ${userUnit} /Resources << /XObject << /Artwork 4 0 R >> >> /Contents 5 0 R >>`),
    (() => { const head=ascii(`<< /Type /XObject /Subtype /Image /Width ${options.jpegWidth} /Height ${options.jpegHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`),tail=ascii('\nendstream'),out=new Uint8Array(head.length+jpeg.length+tail.length);out.set(head);out.set(jpeg,head.length);out.set(tail,head.length+jpeg.length);return out })(),
    ascii(`<< /Length ${ascii(content).length} >>\nstream\n${content}endstream`),
    ascii(`<< /Title (${escapePdf(options.title || 'Ali Baba Signs print-ready artwork')}) /Creator (Ali Baba Signs Design Editor) /Subject (Trim ${options.widthMm} x ${options.heightMm} mm; bleed ${bleed} mm; ${options.productKind || 'rectangle'} contour; crop marks ${options.trimMarks ? 'yes' : 'no'}; safety guides editor-only) >>`),
  ]
  const chunks: Uint8Array[]=[ascii('%PDF-1.6\n%\xE2\xE3\xCF\xD3\n')],offsets=[0];let length=chunks[0].length
  objects.forEach((object,index)=>{offsets.push(length);const head=ascii(`${index+1} 0 obj\n`),tail=ascii('\nendobj\n');chunks.push(head,object,tail);length+=head.length+object.length+tail.length})
  const xrefOffset=length
  chunks.push(ascii(`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map((offset)=>`${String(offset).padStart(10,'0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length+1} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`))
  const output=new Uint8Array(chunks.reduce((sum,chunk)=>sum+chunk.length,0));let cursor=0;chunks.forEach((chunk)=>{output.set(chunk,cursor);cursor+=chunk.length});return output
}
