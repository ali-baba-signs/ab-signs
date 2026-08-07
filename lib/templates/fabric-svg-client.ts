'use client'

import { StaticCanvas, FabricObject, loadSVGFromString, util } from 'fabric'
import { CUSTOM_PROPERTIES } from '@/lib/editor/types'
import { sanitizeSvgMarkup, validateFabricCanvasData } from './svg-sanitization'
import { createTemplateCanvasSize, type MeasurementUnit } from './size-conversion'

FabricObject.customProperties = [...CUSTOM_PROPERTIES]

export async function generateFabricJsonFromSvg(svgSource: string, width: number, height: number, unit: MeasurementUnit) {
  const svg = sanitizeSvgMarkup(svgSource)
  const size = createTemplateCanvasSize(width, height, unit)
  const parsed = await loadSVGFromString(svg)
  const objects = parsed.objects.filter((object): object is FabricObject => Boolean(object))
  if (!objects.length) throw new Error('Fabric.js could not find any supported objects in this SVG.')
  const root = util.groupSVGElements(objects, parsed.options)
  if (!root.width || !root.height) throw new Error('The SVG has no usable dimensions. Add a width, height, or viewBox.')
  const scale = Math.min((size.logicalCanvasWidth * 0.9) / root.width, (size.logicalCanvasHeight * 0.9) / root.height)
  root.set({ left: size.logicalCanvasWidth / 2, top: size.logicalCanvasHeight / 2, originX: 'center', originY: 'center', scaleX: scale, scaleY: scale, subTargetCheck: true, interactive: true })
  root.set({ id: crypto.randomUUID(), name: 'SVG template artwork', role: 'svg-root' })
  const canvas = new StaticCanvas(undefined, { width: size.logicalCanvasWidth, height: size.logicalCanvasHeight, backgroundColor: '#ffffff' })
  canvas.add(root)
  canvas.renderAll()
  const canvasData = validateFabricCanvasData(canvas.toJSON())
  canvas.dispose()
  return { canvasData, ...size, sourceObjectCount: objects.length, scale }
}
