'use client'

import { StaticCanvas, FabricObject, loadSVGFromString, util } from 'fabric'
import { CUSTOM_PROPERTIES } from '@/lib/editor/types'
import { sanitizeSvgMarkup, validateFabricCanvasData } from './svg-sanitization'
import { createTemplateCanvasSize, type MeasurementUnit } from './size-conversion'

FabricObject.customProperties = [...CUSTOM_PROPERTIES]

export async function generateFabricJsonFromSvg(
  svgSource: string,
  width: number,
  height: number,
  unit: MeasurementUnit,
  options: { role?: 'svg-root' | 'fixed-product-layer'; inset?: number } = {},
) {
  const svg = sanitizeSvgMarkup(svgSource)
  const size = createTemplateCanvasSize(width, height, unit)
  const parsed = await loadSVGFromString(svg)
  const objects = parsed.objects.filter((object): object is FabricObject => Boolean(object))
  if (!objects.length) throw new Error('Fabric.js could not find any supported objects in this SVG.')

  const root = util.groupSVGElements(objects, parsed.options)
  if (!root.width || !root.height) throw new Error('The SVG has no usable dimensions. Add a width, height, or viewBox.')

  const fixed = options.role === 'fixed-product-layer'

  // Stretch scale factors directly to match the logical canvas boundaries (0 to 100% full bleed)
  const scaleX = size.logicalCanvasWidth / root.width
  const scaleY = size.logicalCanvasHeight / root.height

  root.set({
    left: 0,
    top: 0,
    originX: 'left',
    originY: 'top',
    scaleX,
    scaleY,
    subTargetCheck: !fixed,
    interactive: !fixed,
  })

  root.set({
    id: crypto.randomUUID(),
    name: fixed ? 'Fixed product shape' : 'Editable template artwork',
    role: options.role || 'svg-root',
    locked: fixed,
    selectable: !fixed,
    evented: !fixed,
    lockMovementX: fixed,
    lockMovementY: fixed,
    lockRotation: fixed,
    lockScalingX: fixed,
    lockScalingY: fixed,
    hasControls: !fixed,
  })

  const canvas = new StaticCanvas(undefined, {
    width: size.logicalCanvasWidth,
    height: size.logicalCanvasHeight,
    backgroundColor: '#ffffff',
  })

  canvas.add(root)
  canvas.renderAll()
  const canvasData = validateFabricCanvasData(canvas.toJSON())
  canvas.dispose()

  return {
    canvasData,
    ...size,
    sourceObjectCount: objects.length,
    scale: scaleX,
    scaleX,
    scaleY,
    printableArea: {
      x: 0,
      y: 0,
      width: size.logicalCanvasWidth,
      height: size.logicalCanvasHeight,
    },
  }
}