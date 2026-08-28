import { FabricObject, Group, Line, Point, Rect, StaticCanvas } from 'fabric'
import type { ProductConfig, EditorObject } from './types'
import { CUSTOM_PROPERTIES } from './types'
import { buildPrintReadyPdf } from '@/lib/pdf/print-ready-core'
import { productionMetadata, productionSpec } from '@/lib/production/production-spec'

FabricObject.customProperties = [...CUSTOM_PROPERTIES]

type ProductionFile<T extends string> = {
  blob: Blob
  contentType: T
  pixelWidth: number
  pixelHeight: number
  metadata: Record<string, unknown>
}

export interface ProductionFiles {
  pdf: ProductionFile<'application/pdf'>
  svg: ProductionFile<'image/svg+xml'>
}

const canvasBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) => new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('The browser could not encode the production artwork.')), type, quality))

function styleGuide(object: FabricObject, color: string, strokeWidth: number, dash: number[]) {
  object.set({ fill: 'rgba(0,0,0,0)', stroke: color, strokeWidth, strokeDashArray: dash, strokeUniform: true, opacity: 1, selectable: false, evented: false, objectCaching: false, excludeFromExport: false })
  if (object instanceof Group) object.forEachObject((child) => styleGuide(child, color, strokeWidth, dash))
}

async function contourGuide(source: EditorObject, scaleX: number, scaleY: number, color: string, strokeWidth: number, dash: number[], role: string) {
  const guide = await source.clone([...CUSTOM_PROPERTIES]) as EditorObject
  const center = source.getCenterPoint()
  guide.set({ id: `production-${role}`, name: role, role: `production-guide-${role}`, scaleX: (source.scaleX ?? 1) * scaleX, scaleY: (source.scaleY ?? 1) * scaleY })
  guide.setPositionByOrigin(new Point(center.x, center.y), 'center', 'center')
  styleGuide(guide, color, strokeWidth, dash)
  guide.setCoords()
  return guide
}

function guideRect(left: number, top: number, width: number, height: number, color: string, strokeWidth: number, dash: number[], role: string) {
  return new Rect({ left, top, width, height, fill: 'rgba(0,0,0,0)', stroke: color, strokeWidth, strokeDashArray: dash, strokeUniform: true, selectable: false, evented: false, id: `production-${role}`, name: role, role: `production-guide-${role}` }) as EditorObject
}

function cropLines(trimLeft: number, trimTop: number, trimRight: number, trimBottom: number, scaleX: number, scaleY: number, strokeWidth: number) {
  const gapX = 1.5 * scaleX, gapY = 1.5 * scaleY, lengthX = 5 * scaleX, lengthY = 5 * scaleY
  const points: Array<[number, number, number, number]> = [
    [trimLeft - gapX - lengthX, trimTop, trimLeft - gapX, trimTop], [trimLeft, trimTop - gapY - lengthY, trimLeft, trimTop - gapY],
    [trimRight + gapX, trimTop, trimRight + gapX + lengthX, trimTop], [trimRight, trimTop - gapY - lengthY, trimRight, trimTop - gapY],
    [trimLeft - gapX - lengthX, trimBottom, trimLeft - gapX, trimBottom], [trimLeft, trimBottom + gapY, trimLeft, trimBottom + gapY + lengthY],
    [trimRight + gapX, trimBottom, trimRight + gapX + lengthX, trimBottom], [trimRight, trimBottom + gapY, trimRight, trimBottom + gapY + lengthY],
  ]
  return points.map((point, index) => new Line(point, { stroke: '#111111', strokeWidth, strokeUniform: true, selectable: false, evented: false, id: `production-crop-${index + 1}`, name: 'Crop mark', role: 'production-guide-crop' }) as EditorObject)
}

async function createProductionCanvas(canvasJson: Record<string, unknown>, config: ProductConfig) {
  const width = Math.max(100, Math.round(config.logicalCanvasWidth)), height = Math.max(100, Math.round(config.logicalCanvasHeight))
  const spec = productionSpec(config), scaleX = width / spec.trimWidthMm, scaleY = height / spec.trimHeightMm
  const trimLeft = (spec.markMarginMm + spec.bleedMm) * scaleX, trimTop = (spec.markMarginMm + spec.bleedMm) * scaleY
  const pageWidth = Math.round(spec.pageWidthMm * scaleX), pageHeight = Math.round(spec.pageHeightMm * scaleY)
  const canvas = new StaticCanvas(document.createElement('canvas'), { width, height, backgroundColor: '#ffffff', renderOnAddRemove: false })
  await canvas.loadFromJSON(canvasJson)
  const fixedLayer = (canvas.getObjects() as EditorObject[]).find((object) => object.role === 'fixed-product-layer')
  if (spec.productKind === 'flag' && !fixedLayer) {
    canvas.dispose()
    throw new Error('The flag template has no fixed silhouette. Add the real Tear Drop or Feather Flag contour before exporting.')
  }
  for (const object of canvas.getObjects()) {
    object.set({ left: (object.left ?? 0) + trimLeft, top: (object.top ?? 0) + trimTop })
    object.setCoords()
  }
  const clipPath = canvas.clipPath as EditorObject | undefined
  if (clipPath?.absolutePositioned) {
    clipPath.set({ left: (clipPath.left ?? 0) + trimLeft, top: (clipPath.top ?? 0) + trimTop })
    clipPath.setCoords()
  }
  canvas.setDimensions({ width: pageWidth, height: pageHeight })
  canvas.backgroundColor = '#ffffff'
  const pixelsPerMm = (scaleX + scaleY) / 2
  const strokeWidth = Math.max(0.5, pixelsPerMm * 0.25), dash = [Math.max(2, pixelsPerMm * 4), Math.max(1, pixelsPerMm * 2)]
  if (spec.productKind === 'flag' && fixedLayer) {
    const outerX = (spec.trimWidthMm + spec.bleedMm * 2) / spec.trimWidthMm, outerY = (spec.trimHeightMm + spec.bleedMm * 2) / spec.trimHeightMm
    canvas.add(
      await contourGuide(fixedLayer, outerX, outerY, '#ec008c', strokeWidth, dash, 'bleed-contour'),
      await contourGuide(fixedLayer, 1, 1, '#111111', strokeWidth, [], 'cut-contour'),
    )
  } else {
    canvas.add(
      guideRect(spec.markMarginMm * scaleX, spec.markMarginMm * scaleY, (spec.trimWidthMm + spec.bleedMm * 2) * scaleX, (spec.trimHeightMm + spec.bleedMm * 2) * scaleY, '#ec008c', strokeWidth, dash, 'bleed-boundary'),
      guideRect(trimLeft, trimTop, width, height, '#111111', strokeWidth, [], 'cut-line'),
    )
  }
  if (spec.cropMarks) canvas.add(...cropLines(trimLeft, trimTop, trimLeft + width, trimTop + height, scaleX, scaleY, strokeWidth))
  canvas.renderAll()
  return { canvas, spec, pageWidth, pageHeight }
}

function injectSvgMetadata(svg: string, metadata: Record<string, unknown>, title: string) {
  const escapedTitle = title.replace(/[&<>"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[character]!)
  const encoded = JSON.stringify(metadata).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  return svg.replace(/(<svg\b[^>]*>)/, `$1<title>${escapedTitle}</title><desc>Print-ready artwork with bleed, cut contour, crop marks, and exact physical dimensions. Safety guides are editor-only.</desc><metadata id="alibaba-signs-production">${encoded}</metadata>`)
}

export async function renderProductionFiles(canvasJson: Record<string, unknown>, config: ProductConfig, title = 'Ali Baba Signs production artwork'): Promise<ProductionFiles> {
  const { canvas, spec, pageWidth, pageHeight } = await createProductionCanvas(canvasJson, config)
  try {
    const metadata = productionMetadata(config)
    const svgMarkup = injectSvgMetadata(canvas.toSVG({ suppressPreamble: false, width: `${spec.pageWidthMm}mm`, height: `${spec.pageHeightMm}mm` }), metadata, title)
    const svg = { blob: new Blob([svgMarkup], { type: 'image/svg+xml' }), contentType: 'image/svg+xml' as const, pixelWidth: pageWidth, pixelHeight: pageHeight, metadata }
    const multiplier = Math.min(4, 6000 / Math.max(pageWidth, pageHeight))
    const raster = canvas.toCanvasElement(multiplier)
    const jpegBlob = await canvasBlob(raster, 'image/jpeg', 0.98)
    const pdfBytes = buildPrintReadyPdf(new Uint8Array(await jpegBlob.arrayBuffer()), { widthMm: spec.trimWidthMm, heightMm: spec.trimHeightMm, bleedMm: spec.bleedMm, safetyMm: spec.safetyMm, productKind: spec.productKind, trimMarks: spec.cropMarks, jpegWidth: raster.width, jpegHeight: raster.height, title, renderedPageWidthMm: spec.pageWidthMm, renderedPageHeightMm: spec.pageHeightMm })
    const pdf = { blob: new Blob([pdfBytes], { type: 'application/pdf' }), contentType: 'application/pdf' as const, pixelWidth: raster.width, pixelHeight: raster.height, metadata }
    return { pdf, svg }
  } finally { canvas.dispose() }
}

export function downloadProductionFile(file: ProductionFile<string>, filename: string) {
  const url = URL.createObjectURL(file.blob)
  try { const link = document.createElement('a'); link.href = url; link.download = filename; link.click() }
  finally { window.setTimeout(() => URL.revokeObjectURL(url), 1000) }
}

export async function renderPrintReadyPdf(canvasJson: Record<string, unknown>, config: ProductConfig, title?: string) { return (await renderProductionFiles(canvasJson, config, title)).pdf }
export async function downloadPrintReadyPdf(canvasJson: Record<string, unknown>, config: ProductConfig, filename: string) { downloadProductionFile((await renderProductionFiles(canvasJson, config, filename.replace(/\.pdf$/i, ''))).pdf, filename) }
