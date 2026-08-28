'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Canvas, FabricImage, FabricObject, Group, Point, Rect, Textbox, loadSVGFromString, util,
} from 'fabric'
import { EditorHeader } from './EditorHeader'
import { EditorSidebar } from './EditorSidebar'
import { CanvasWorkspace } from './CanvasWorkspace'
import { EditorPanels } from './panels/EditorPanels'
import { useCanvasHistory } from './hooks/useCanvasHistory'
import { DEFAULT_PRODUCT_CONFIG, normalizeProductConfig } from '@/lib/editor/editor-config'
import { useSession } from '@/lib/auth-client'
import { fetchTemplate } from '@/lib/editor/templates'
import { loadDesign as loadStoredDesign, saveDesign, serializeDesign } from '@/lib/editor/design-serialization'
import { renderBrowserSide, uploadBrowserRender, uploadProductionFile } from '@/lib/editor/browser-preview'
import { downloadProductionFile, renderProductionFiles } from '@/lib/editor/browser-print-pdf'
import {
  CUSTOM_PROPERTIES,
  type DesignTemplate,
  type EditorObject,
  type EditorSection,
  type ProductConfig,
} from '@/lib/editor/types'

FabricObject.customProperties = [...CUSTOM_PROPERTIES]
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
const ALLOWED_UPLOADS = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])

async function addWatermark(dataUrl: string) {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new window.Image()
    element.onload = () => resolve(element)
    element.onerror = () => reject(new Error('Preview could not be prepared'))
    element.src = dataUrl
  })
  const output = document.createElement('canvas')
  output.width = image.naturalWidth
  output.height = image.naturalHeight
  const context = output.getContext('2d')
  if (!context) return dataUrl
  context.drawImage(image, 0, 0)
  const fontSize = Math.max(22, Math.round(output.width / 24))
  context.font = `700 ${fontSize}px Arial`
  context.fillStyle = 'rgba(237,27,104,.22)'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.rotate(-Math.PI / 7)
  for (let y = -output.height; y < output.height * 2; y += fontSize * 4) {
    for (let x = -output.width; x < output.width * 2; x += fontSize * 10) {
      context.fillText('ALI BABA SIGNS', x, y)
    }
  }
  return output.toDataURL('image/png')
}

function applyLock(object: EditorObject, locked: boolean) {
  object.set({
    locked,
    lockMovementX: locked,
    lockMovementY: locked,
    lockRotation: locked,
    lockScalingX: locked,
    lockScalingY: locked,
    hasControls: !locked,
    selectable: true,
  })
}

function isFixedLayer(object: EditorObject) {
  return object.role === 'fixed-product-layer'
}

function applyFixedLayer(object: EditorObject) {
  object.set({
    locked: true,
    selectable: false,
    evented: false,
    subTargetCheck: false,
    interactive: false,
    lockMovementX: true,
    lockMovementY: true,
    lockRotation: true,
    lockScalingX: true,
    lockScalingY: true,
    hasControls: false,
    hoverCursor: 'default',
  })
}

function styleCanvasGuide(object: FabricObject, color: string, dash: number[]) {
  object.set({ fill: 'rgba(0,0,0,0)', stroke: color, strokeWidth: 1, strokeDashArray: dash, strokeUniform: true, opacity: 1, selectable: false, evented: false, objectCaching: false })
  if (object instanceof Group) object.forEachObject((child) => styleCanvasGuide(child, color, dash))
}

async function flagCanvasGuide(source: EditorObject, scaleX: number, scaleY: number, color: string, dash: number[]) {
  const guide = await source.clone([...CUSTOM_PROPERTIES]) as EditorObject
  const center = source.getCenterPoint()
  guide.set({ scaleX: (source.scaleX ?? 1) * scaleX, scaleY: (source.scaleY ?? 1) * scaleY })
  guide.setPositionByOrigin(new Point(center.x, center.y), 'center', 'center')
  styleCanvasGuide(guide, color, dash)
  guide.setCoords()
  return guide
}

async function createFlagCanvasGuides(source: EditorObject, config: ProductConfig) {
  const outerX = (config.widthMm + config.bleedMm * 2) / config.widthMm, outerY = (config.heightMm + config.bleedMm * 2) / config.heightMm
  const safetyX = Math.max(0.05, (config.widthMm - config.safeMarginMm * 2) / config.widthMm), safetyY = Math.max(0.05, (config.heightMm - config.safeMarginMm * 2) / config.heightMm)
  return Promise.all([
    flagCanvasGuide(source, outerX, outerY, '#ed1b68', [8, 6]),
    flagCanvasGuide(source, 1, 1, '#111111', []),
    flagCanvasGuide(source, safetyX, safetyY, '#22c55e', [8, 6]),
  ])
}

function unpackSvgRoot(canvas: Canvas) {
  for (const root of [...canvas.getObjects()] as EditorObject[]) {
    if (root.role !== 'svg-root' || root.type !== 'group') continue
    const group = root as Group & EditorObject
    const transform = group.calcTransformMatrix()
    const children = group.removeAll() as EditorObject[]
    canvas.remove(group)
    for (const child of children) {
      util.sendObjectToPlane(child, transform)
      child.set({ id: child.id || crypto.randomUUID(), name: child.name || child.type || 'SVG object', role: child.role || 'svg-object' })
      canvas.add(child)
    }
  }
}

function scaleComposition(
  canvas: Canvas,
  _baseWidth: number,
  _baseHeight: number,
  targetWidth: number,
  targetHeight: number,
  _fitMode: 'contain' | 'cover' | 'stretch' = 'stretch'
) {
  const editableObjects = (canvas.getObjects() as EditorObject[]).filter(
    (obj) => !isFixedLayer(obj) && obj.role !== 'fixed-product-layer'
  )
  if (!editableObjects.length) return

  // 1. Calculate true global bounds of all editable elements
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const obj of editableObjects) {
    obj.setCoords()
    const bound = obj.getBoundingRect()
    minX = Math.min(minX, bound.left)
    minY = Math.min(minY, bound.top)
    maxX = Math.max(maxX, bound.left + bound.width)
    maxY = Math.max(maxY, bound.top + bound.height)
  }

  const currentWidth = maxX > minX ? maxX - minX : targetWidth
  const currentHeight = maxY > minY ? maxY - minY : targetHeight

  // 2. Compute stretch multipliers to map content directly to [0, 0, targetWidth, targetHeight]
  const scaleFactorX = targetWidth / Math.max(1, currentWidth)
  const scaleFactorY = targetHeight / Math.max(1, currentHeight)

  // 3. Scale and normalize each object directly from top-left (0, 0)
  for (const obj of editableObjects) {
    const relativeLeft = (obj.left ?? 0) - minX
    const relativeTop = (obj.top ?? 0) - minY

    obj.set({
      left: relativeLeft * scaleFactorX,
      top: relativeTop * scaleFactorY,
      scaleX: (obj.scaleX ?? 1) * scaleFactorX,
      scaleY: (obj.scaleY ?? 1) * scaleFactorY,
    })
    obj.setCoords()
  }
}

type SideTemplateSource = {
  id: string
  name: string
  canvasData: Record<string, unknown>
  fixedCanvasData: Record<string, unknown> | null
  templateKind: 'banner' | 'flag'
  baseCanvasWidth: number
  baseCanvasHeight: number
  fitMode: 'contain' | 'cover' | 'stretch'
}

export function CanvasEditor() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestedTemplateId = searchParams.get('templateId')
  const requestedProductId = searchParams.get('productId')
  const requestedSizeId = searchParams.get('sizeId')
  const requestedDesignType = searchParams.get('designType')
  const { data: session } = useSession()
  const elementRef = useRef<HTMLCanvasElement>(null)
  const workspaceRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<Canvas | null>(null)
  const guidesEnabledRef = useRef(true)
  const [active, setActive] = useState<EditorSection>('templates')
  const [selected, setSelected] = useState<EditorObject | null>(null)
  const [objects, setObjects] = useState<EditorObject[]>([])
  const [productConfig, setProductConfig] = useState(DEFAULT_PRODUCT_CONFIG)
  const configRef = useRef(productConfig)
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [guides, setGuides] = useState(true)
  const [zoom, setZoom] = useState(1)
  const [status, setStatus] = useState('Ready')
  const [processing, setProcessing] = useState<string | null>(null)
  const busyRef = useRef(false)
  const [currentSide, setCurrentSide] = useState<'front' | 'back'>('front')
  const currentSideRef = useRef<'front' | 'back'>('front')
  const sideStatesRef = useRef<Partial<Record<'front' | 'back', Record<string, unknown>>>>({})
  const savedDesignId = useRef<string | null>(null)
  const originalTemplateRef = useRef<Record<string, unknown> | null>(null)
  const fixedTemplateRef = useRef<Record<string, unknown> | null>(null)
  const flagGuideRefs = useRef<EditorObject[]>([])
  const templateKindRef = useRef<'banner' | 'flag'>('banner')
  const baseCanvasRef = useRef({ width: DEFAULT_PRODUCT_CONFIG.logicalCanvasWidth, height: DEFAULT_PRODUCT_CONFIG.logicalCanvasHeight, fitMode: 'contain' as 'contain' | 'cover' | 'stretch' })
  const sideTemplateSourcesRef = useRef<Partial<Record<'front' | 'back', SideTemplateSource>>>({})
  const sideTemplateIdsRef = useRef<{ front: string | null; back?: string | null }>({ front: null })
  const frontHistory = useCanvasHistory(canvasRef)
  const backHistory = useCanvasHistory(canvasRef)
  const snapshot = useCallback(() => (currentSideRef.current === 'front' ? frontHistory.snapshot : backHistory.snapshot)(), [backHistory.snapshot, frontHistory.snapshot])
  const scheduleSnapshot = useCallback((delay?: number) => (currentSideRef.current === 'front' ? frontHistory.scheduleSnapshot : backHistory.scheduleSnapshot)(delay), [backHistory.scheduleSnapshot, frontHistory.scheduleSnapshot])
  const reset = useCallback(() => (currentSideRef.current === 'front' ? frontHistory.reset : backHistory.reset)(), [backHistory.reset, frontHistory.reset])
  const undo = useCallback(() => (currentSideRef.current === 'front' ? frontHistory.undo : backHistory.undo)(), [backHistory.undo, frontHistory.undo])
  const redo = useCallback(() => (currentSideRef.current === 'front' ? frontHistory.redo : backHistory.redo)(), [backHistory.redo, frontHistory.redo])
  const runWhileRestoring = useCallback(<T,>(task: () => Promise<T>) => (currentSideRef.current === 'front' ? frontHistory.runWhileRestoring : backHistory.runWhileRestoring)(task), [backHistory.runWhileRestoring, frontHistory.runWhileRestoring])
  const canUndo = currentSide === 'front' ? frontHistory.canUndo : backHistory.canUndo
  const canRedo = currentSide === 'front' ? frontHistory.canRedo : backHistory.canRedo

  const refreshObjects = useCallback(() => {
    setObjects(((canvasRef.current?.getObjects() ?? []) as EditorObject[]).filter((object) => !isFixedLayer(object)))
  }, [])

  const fitToScreen = useCallback((config = configRef.current) => {
    const canvas = canvasRef.current
    const workspace = workspaceRef.current
    if (!canvas || !workspace) return
    const availableWidth = Math.max(280, workspace.clientWidth - 110)
    const availableHeight = Math.max(220, workspace.clientHeight - 110)
    const nextZoom = Math.min(
      availableWidth / config.logicalCanvasWidth,
      availableHeight / config.logicalCanvasHeight,
      1,
    )
    canvas.setDimensions({
      width: Math.round(config.logicalCanvasWidth * nextZoom),
      height: Math.round(config.logicalCanvasHeight * nextZoom),
    })
    canvas.setZoom(nextZoom)
    canvas.requestRenderAll()
    setZoom(nextZoom)
  }, [])

  const drawGuides = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !guidesEnabledRef.current) return
    const ctx = canvas.getContext()
    const config = configRef.current
    const zoomValue = canvas.getZoom()
    const safeX = (config.safeMarginMm / config.widthMm) * config.logicalCanvasWidth
    const safeY = (config.safeMarginMm / config.heightMm) * config.logicalCanvasHeight
    const bleedX = Math.max(4, (config.bleedMm / config.widthMm) * config.logicalCanvasWidth)
    const bleedY = Math.max(4, (config.bleedMm / config.heightMm) * config.logicalCanvasHeight)
    ctx.save()
    ctx.scale(zoomValue, zoomValue)
    if (config.productCategory === 'flag' && flagGuideRefs.current.length) {
      for (const guide of flagGuideRefs.current) guide.render(ctx)
      ctx.restore()
      return
    }
    ctx.setLineDash([8 / zoomValue, 6 / zoomValue])
    ctx.lineWidth = 1 / zoomValue
    ctx.strokeStyle = '#ed1b68'
    ctx.strokeRect(bleedX, bleedY, config.logicalCanvasWidth - bleedX * 2, config.logicalCanvasHeight - bleedY * 2)
    ctx.strokeStyle = '#0ea5e9'
    ctx.strokeRect(2, 2, config.logicalCanvasWidth - 4, config.logicalCanvasHeight - 4)
    ctx.strokeStyle = '#22c55e'
    ctx.strokeRect(safeX, safeY, config.logicalCanvasWidth - safeX * 2, config.logicalCanvasHeight - safeY * 2)
    ctx.restore()
  }, [])

  const activateTemplateSide = useCallback((side: 'front' | 'back') => {
    const source = sideTemplateSourcesRef.current[side]
    if (!source) return
    originalTemplateRef.current = source.canvasData
    fixedTemplateRef.current = source.fixedCanvasData
    templateKindRef.current = source.templateKind
    baseCanvasRef.current = { width: source.baseCanvasWidth, height: source.baseCanvasHeight, fitMode: source.fitMode }
  }, [])

 const restoreOriginalAtSize = useCallback(async (config: ProductConfig, side = currentSideRef.current) => {
    const canvas = canvasRef.current
    activateTemplateSide(side)
    const original = originalTemplateRef.current
    if (!canvas || !original) return
    canvas.renderOnAddRemove = false
    try {
      await runWhileRestoring(async () => {
        const editableObjects = Array.isArray(original.objects) ? original.objects : []
        const fixedObjects = Array.isArray(fixedTemplateRef.current?.objects) ? fixedTemplateRef.current.objects : []
        await canvas.loadFromJSON({ ...original, objects: [...fixedObjects, ...editableObjects], clipPath: undefined })
        
        // 1. Unpack initial SVG root group into flat canvas objects
        unpackSvgRoot(canvas)

        // 2. Add fixed banner rectangle if banner template has no fixed SVG
        if (!fixedObjects.length && templateKindRef.current === 'banner') {
          const background = new Rect({
            left: 0,
            top: 0,
            width: config.logicalCanvasWidth,
            height: config.logicalCanvasHeight,
            fill: '#ffffff',
            stroke: '#d4d4d8',
            strokeWidth: 1,
            id: crypto.randomUUID(),
            name: 'Fixed banner product layer',
            role: 'fixed-product-layer',
          }) as EditorObject
          applyFixedLayer(background)
          canvas.insertAt(0, background)
        }

        // 3. Stretch all editable objects to (0, 0) -> (targetWidth, targetHeight)
        scaleComposition(
          canvas,
          baseCanvasRef.current.width,
          baseCanvasRef.current.height,
          config.logicalCanvasWidth,
          config.logicalCanvasHeight,
          'stretch'
        )

        // 4. Stretch the fixed layer to exact target dimensions
        const fixedLayer = (canvas.getObjects() as EditorObject[]).find(isFixedLayer)
        if (fixedLayer) {
          fixedLayer.set({
            left: 0,
            top: 0,
            originX: 'left',
            originY: 'top',
            scaleX: config.logicalCanvasWidth / Math.max(1, fixedLayer.width || config.logicalCanvasWidth),
            scaleY: config.logicalCanvasHeight / Math.max(1, fixedLayer.height || config.logicalCanvasHeight),
          })
          fixedLayer.setCoords()
          applyFixedLayer(fixedLayer)
        }

        // 5. Configure flag clipping mask if applicable
        canvas.clipPath = undefined
        if (templateKindRef.current === 'flag' && fixedLayer) {
          const clipPath = (await fixedLayer.clone([...CUSTOM_PROPERTIES])) as EditorObject
          clipPath.set({
            left: 0,
            top: 0,
            originX: 'left',
            originY: 'top',
            scaleX: fixedLayer.scaleX,
            scaleY: fixedLayer.scaleY,
            absolutePositioned: true,
            selectable: false,
            evented: false,
            stroke: undefined,
          })
          canvas.clipPath = clipPath
          flagGuideRefs.current = await createFlagCanvasGuides(fixedLayer, config)
        } else {
          flagGuideRefs.current = []
        }

        canvas.setDimensions({ width: config.logicalCanvasWidth, height: config.logicalCanvasHeight })
      })
    } finally { 
      canvas.renderOnAddRemove = true 
    }
    canvas.requestRenderAll()
  }, [activateTemplateSide, runWhileRestoring])

  useEffect(() => {
    if (!elementRef.current) return
    const canvas = new Canvas(elementRef.current, {
      width: DEFAULT_PRODUCT_CONFIG.logicalCanvasWidth,
      height: DEFAULT_PRODUCT_CONFIG.logicalCanvasHeight,
      backgroundColor: '#ffffff',
      preserveObjectStacking: true,
      selectionColor: 'rgba(237,27,104,.08)',
      selectionBorderColor: '#ed1b68',
    })
    canvasRef.current = canvas
    const selection = () => setSelected((canvas.getActiveObject() as EditorObject | undefined) ?? null)
    const changed = () => {
      snapshot()
      refreshObjects()
      setStatus('Unsaved changes')
    }
    canvas.on('selection:created', selection)
    canvas.on('selection:updated', selection)
    canvas.on('selection:cleared', selection)
    canvas.on('object:added', changed)
    canvas.on('object:removed', changed)
    canvas.on('object:modified', changed)
    canvas.on('text:changed', () => { scheduleSnapshot(); refreshObjects(); setStatus('Unsaved changes') })
    canvas.on('after:render', drawGuides)

    const saved = requestedTemplateId ? null : loadStoredDesign()
    const initialize = async () => {
      try {
        if (requestedTemplateId) {
          setStatus('Loading product template…')
          const params = new URLSearchParams()
          if (requestedProductId) params.set('productId', requestedProductId)
          if (requestedSizeId) params.set('sizeId', requestedSizeId)
          if (requestedDesignType) params.set('designType', requestedDesignType)
          const response = await fetch(`/api/templates/${requestedTemplateId}/editor-data?${params}`, { cache: 'no-store' })
          const payload = await response.json()
          if (!response.ok) throw new Error(payload.error?.message || 'The selected template could not be loaded.')
          configRef.current = payload.data.productConfig
          setProductConfig(payload.data.productConfig)
          setTemplateId(payload.data.template.id)
          sideTemplateSourcesRef.current = {
            front: { id: payload.data.template.id, name: payload.data.template.name, canvasData: payload.data.template.canvasData, fixedCanvasData: payload.data.template.fixedCanvasData || null, templateKind: payload.data.template.templateKind === 'flag' ? 'flag' : 'banner', baseCanvasWidth: payload.data.template.baseCanvasWidth, baseCanvasHeight: payload.data.template.baseCanvasHeight, fitMode: payload.data.fitMode || 'contain' },
            ...(payload.data.backTemplate ? { back: { id: payload.data.backTemplate.id, name: payload.data.backTemplate.name, canvasData: payload.data.backTemplate.canvasData, fixedCanvasData: payload.data.backTemplate.fixedCanvasData || null, templateKind: payload.data.backTemplate.templateKind === 'flag' ? 'flag' : 'banner', baseCanvasWidth: payload.data.backTemplate.baseCanvasWidth, baseCanvasHeight: payload.data.backTemplate.baseCanvasHeight, fitMode: payload.data.fitMode || 'contain' } } : {}),
          }
          sideTemplateIdsRef.current = { front: payload.data.template.id, ...(payload.data.backTemplate ? { back: payload.data.backTemplate.id } : {}) }
          sideStatesRef.current = {}
          currentSideRef.current = 'front'; setCurrentSide('front')
          await restoreOriginalAtSize(payload.data.productConfig, 'front')
          sideStatesRef.current.front = canvas.toJSON()
          if (payload.data.productConfig.sideMode === 'double' && payload.data.backTemplate) {
            await restoreOriginalAtSize(payload.data.productConfig, 'back')
            sideStatesRef.current.back = canvas.toJSON()
            await runWhileRestoring(() => canvas.loadFromJSON(sideStatesRef.current.front!))
            activateTemplateSide('front')
            const frontFixedLayer = (canvas.getObjects() as EditorObject[]).find(isFixedLayer)
            flagGuideRefs.current = templateKindRef.current === 'flag' && frontFixedLayer ? await createFlagCanvasGuides(frontFixedLayer, payload.data.productConfig) : []
          }
          setStatus(`${payload.data.template.name}${payload.data.backTemplate ? ` + ${payload.data.backTemplate.name}` : ''} loaded for ${payload.data.productSize?.label || 'its fixed size'}`)
        } else if (saved) {
          configRef.current = saved.productConfig
          setProductConfig(saved.productConfig)
          templateKindRef.current = saved.productConfig.productCategory === 'flag' ? 'flag' : 'banner'
          setTemplateId(saved.templateId)
          sideTemplateIdsRef.current = { front: saved.front?.templateId ?? saved.templateId, ...(saved.back ? { back: saved.back.templateId } : {}) }
          sideStatesRef.current = saved.sides ? { front: saved.sides.front.canvasJson, ...(saved.sides.back ? { back: saved.sides.back.canvasJson } : {}) } : saved.front ? { front: saved.front.canvasJson, ...(saved.back ? { back: saved.back.canvasJson } : {}) } : { front: saved.canvasJson }
          await runWhileRestoring(() => canvas.loadFromJSON(sideStatesRef.current.front || saved.canvasJson))
          const restoredFixedLayer = (canvas.getObjects() as EditorObject[]).find(isFixedLayer)
          flagGuideRefs.current = templateKindRef.current === 'flag' && restoredFixedLayer ? await createFlagCanvasGuides(restoredFixedLayer, saved.productConfig) : []
          setStatus(`Restored ${new Date(saved.updatedAt).toLocaleString()}`)
        }
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'The selected template could not be loaded.')
      }
      refreshObjects()
      reset()
      requestAnimationFrame(() => fitToScreen(configRef.current))
    }
    void initialize()

    const resize = () => fitToScreen()
    window.addEventListener('resize', resize)
    return () => {
      window.removeEventListener('resize', resize)
      canvas.dispose()
      canvasRef.current = null
    }
  }, [activateTemplateSide, drawGuides, fitToScreen, refreshObjects, requestedDesignType, requestedProductId, requestedSizeId, requestedTemplateId, reset, restoreOriginalAtSize, runWhileRestoring, scheduleSnapshot, snapshot])

  const addText = useCallback((kind: 'heading' | 'subheading' | 'body') => {
    const canvas = canvasRef.current
    if (!canvas) return
    const settings = {
      heading: { text: 'Your heading', fontSize: 68, fontWeight: 'bold' },
      subheading: { text: 'Your subheading', fontSize: 40, fontWeight: '600' },
      body: { text: 'Add your text here', fontSize: 26, fontWeight: 'normal' },
    }[kind]
    const object = new Textbox(settings.text, {
      left: configRef.current.logicalCanvasWidth * 0.25,
      top: configRef.current.logicalCanvasHeight * 0.3,
      width: configRef.current.logicalCanvasWidth * 0.5,
      fontSize: settings.fontSize,
      fontWeight: settings.fontWeight,
      fontFamily: 'Arial',
      fill: '#231f20',
      textAlign: 'center',
    }) as EditorObject
    object.set({ id: crypto.randomUUID(), name: `${kind[0].toUpperCase()}${kind.slice(1)}`, role: kind })
    canvas.add(object)
    canvas.setActiveObject(object)
    canvas.requestRenderAll()
  }, [])

  const deleteSelected = useCallback(() => {
    const canvas = canvasRef.current
    const object = canvas?.getActiveObject() as EditorObject | undefined
    if (!canvas || !object || object.locked) return
    canvas.remove(object)
    canvas.discardActiveObject()
    canvas.requestRenderAll()
  }, [])

  const duplicateSelected = useCallback(async () => {
    const canvas = canvasRef.current
    const object = canvas?.getActiveObject() as EditorObject | undefined
    if (!canvas || !object) return
    const clone = await object.clone([...CUSTOM_PROPERTIES]) as EditorObject
    clone.set({ left: (object.left ?? 0) + 18, top: (object.top ?? 0) + 18, id: crypto.randomUUID(), locked: false })
    applyLock(clone, false)
    canvas.add(clone)
    canvas.setActiveObject(clone)
    canvas.requestRenderAll()
  }, [])

  const loadTemplate = useCallback(async (template: DesignTemplate) => {
    if (canUndo && !window.confirm('Replace your current artwork with this template?')) return
    if (template.productId && template.sizeId && (requestedTemplateId !== template.id || requestedProductId !== template.productId || requestedSizeId !== template.sizeId)) {
      router.push(`/design?templateId=${encodeURIComponent(template.id)}&productId=${encodeURIComponent(template.productId)}&sizeId=${encodeURIComponent(template.sizeId)}${requestedDesignType ? `&designType=${encodeURIComponent(requestedDesignType)}` : ''}`)
      return
    }
    const canvas = canvasRef.current
    if (!canvas) return
    setStatus('Loading template…')
    try {
      const loaded = await fetchTemplate(template)
      canvas.discardActiveObject()
      sideTemplateSourcesRef.current = {
        front: { id: template.id, name: template.name, canvasData: loaded.json, fixedCanvasData: loaded.fixedCanvasData || null, templateKind: loaded.templateKind, baseCanvasWidth: template.width, baseCanvasHeight: template.height, fitMode: loaded.fitMode },
        ...(loaded.backTemplate ? { back: { id: loaded.backTemplate.id, name: loaded.backTemplate.name, canvasData: loaded.backTemplate.json, fixedCanvasData: loaded.backTemplate.fixedCanvasData, templateKind: loaded.backTemplate.templateKind, baseCanvasWidth: loaded.backTemplate.baseCanvasWidth, baseCanvasHeight: loaded.backTemplate.baseCanvasHeight, fitMode: loaded.fitMode } } : {}),
      }
      sideTemplateIdsRef.current = { front: template.id, ...(loaded.backTemplate ? { back: loaded.backTemplate.id } : {}) }
      activateTemplateSide('front')
      const config = loaded.productConfig || configRef.current
      configRef.current = config
      setProductConfig(config)
      await restoreOriginalAtSize(config)
      for (const object of canvas.getObjects() as EditorObject[]) {
        if (!object.id) object.set({ id: crypto.randomUUID() })
        if (isFixedLayer(object)) applyFixedLayer(object)
        else if (object.locked) applyLock(object, true)
      }
      setTemplateId(template.id)
      refreshObjects()
      reset()
      canvas.requestRenderAll()
      setStatus(`${template.name} loaded`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Template failed to load')
    }
  }, [activateTemplateSide, canUndo, refreshObjects, requestedDesignType, requestedProductId, requestedSizeId, requestedTemplateId, reset, restoreOriginalAtSize, router])

  const upload = useCallback(async (file: File) => {
    if (!ALLOWED_UPLOADS.has(file.type)) return setStatus('Unsupported image type')
    if (file.size > MAX_UPLOAD_BYTES) return setStatus('Image is larger than 10 MB')
    const canvas = canvasRef.current
    if (!canvas || busyRef.current) return
    busyRef.current = true; setProcessing('Uploading your artwork…')
    try {
      let assetKey: string | undefined
      if (session?.user && file.type !== 'image/svg+xml') {
        const presignResponse = await fetch('/api/uploads/presign', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size, purpose: 'design-artwork' }) })
        const presignPayload = await presignResponse.json()
        if (!presignResponse.ok) throw new Error(presignPayload.error?.message || 'The artwork upload could not be prepared.')
        const uploadResponse = await fetch(presignPayload.data.uploadUrl, { method: 'PUT', headers: { 'content-type': file.type }, body: file })
        if (!uploadResponse.ok) throw new Error('The artwork upload failed. Please retry.')
        assetKey = presignPayload.data.key
      }
      const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Unable to read image')); reader.readAsDataURL(file) })
      let object: EditorObject
      if (file.type === 'image/svg+xml') { const text = await file.text(); if (/<script|javascript:|https?:\/\//i.test(text)) throw new Error('Unsafe SVG was rejected.'); const parsed = await loadSVGFromString(text); object = util.groupSVGElements(parsed.objects.filter(Boolean) as FabricObject[], parsed.options) as EditorObject }
      else object = await FabricImage.fromURL(dataUrl) as EditorObject
      const maxWidth = configRef.current.logicalCanvasWidth * 0.45
      if ((object.width ?? 1) > maxWidth) object.scaleToWidth(maxWidth)
      object.set({ left: 100, top: 100, id: crypto.randomUUID(), name: file.name, role: 'uploaded-image', assetKey })
      canvas.add(object); canvas.setActiveObject(object); canvas.requestRenderAll(); setStatus(`${file.name} added`)
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Artwork upload failed.') }
    finally { busyRef.current = false; setProcessing(null) }
  }, [session])

  const addGraphic = useCallback(async (path: string, name: string) => {
    const response = await fetch(path)
    const svg = await response.text()
    const parsed = await loadSVGFromString(svg)
    const object = util.groupSVGElements(parsed.objects.filter(Boolean) as FabricObject[], parsed.options) as EditorObject
    object.scaleToWidth(130)
    object.set({ left: 120, top: 120, id: crypto.randomUUID(), name, role: 'graphic' })
    canvasRef.current?.add(object)
    canvasRef.current?.setActiveObject(object)
    canvasRef.current?.requestRenderAll()
  }, [])

  const changeSelected = useCallback((values: Record<string, unknown>) => {
    const canvas = canvasRef.current
    const object = canvas?.getActiveObject()
    if (!canvas || !object) return
    object.set(values)
    object.setCoords()
    canvas.requestRenderAll()
    snapshot()
    setSelected(object as EditorObject)
  }, [snapshot])

  const changeProduct = useCallback((next: ProductConfig) => {
    const normalized = normalizeProductConfig(next)
    configRef.current = normalized
    setProductConfig(normalized)
    void restoreOriginalAtSize(normalized).then(() => { refreshObjects(); reset(); fitToScreen(normalized); setStatus('Product size updated from the original template') })
  }, [fitToScreen, refreshObjects, reset, restoreOriginalAtSize])

  const layerAction = useCallback((object: EditorObject, action: string) => {
    const canvas = canvasRef.current
    if (!canvas || isFixedLayer(object)) return
    if (action === 'forward') canvas.bringObjectForward(object)
    if (action === 'backward') canvas.sendObjectBackwards(object)
    if (action === 'front') canvas.bringObjectToFront(object)
    if (action === 'back') canvas.sendObjectToBack(object)
    if (action === 'visible') object.set({ visible: object.visible === false })
    if (action === 'lock') applyLock(object, !object.locked)
    if (action === 'delete' && !object.locked) canvas.remove(object)
    canvas.requestRenderAll()
    refreshObjects()
    snapshot()
  }, [refreshObjects, snapshot])

  const save = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas || busyRef.current) return null
    busyRef.current = true
    setProcessing('Preparing your design…')
    sideStatesRef.current[currentSideRef.current] = canvas.toJSON()
    const sides = configRef.current.sideMode === 'double' && sideStatesRef.current.front ? { front: { canvasJson: sideStatesRef.current.front }, ...(sideStatesRef.current.back ? { back: { canvasJson: sideStatesRef.current.back } } : {}) } : undefined
    const design = serializeDesign(canvas, configRef.current, templateId, sides, sideTemplateIdsRef.current)
    saveDesign(design)
    if (!session?.user) {
      setStatus('Saved temporarily on this device. Sign in to save a private draft.')
      busyRef.current = false
      setProcessing(null)
      return `local:${templateId || 'blank'}:${Date.now()}`
    }

    try {
      setStatus('Rendering design preview…')
      setProcessing('Rendering your artwork…')
      const renderGroupId = savedDesignId.current ?? crypto.randomUUID()
      const renderAndUpload = async (canvasJson: Record<string, unknown>, side: 'front' | 'back') => {
        const rendered = await renderBrowserSide(canvasJson, configRef.current)
        const production = await renderProductionFiles(canvasJson, configRef.current, `${side} production artwork`)
        setProcessing(`Uploading ${side} artwork…`)
        const [previewAsset, productionPdf, productionSvg] = await Promise.all([
          uploadBrowserRender(rendered.preview, `${side}-preview.png`, renderGroupId),
          uploadProductionFile(production.pdf, `${side}-production.pdf`, renderGroupId),
          uploadProductionFile(production.svg, `${side}-production.svg`, renderGroupId),
        ])
        return { preview: previewAsset, production: { pdf: productionPdf, svg: productionSvg } }
      }
      const frontJson = design.sides?.front.canvasJson ?? design.canvasJson
      const front = await renderAndUpload(frontJson, 'front')
      const backJson = design.sides?.back?.canvasJson ?? design.back?.canvasJson
      if (configRef.current.sideMode === 'double' && !backJson) throw new Error('The back-side canvas is missing. Open the Back tab before saving this design.')
      const back = backJson ? await renderAndUpload(backJson, 'back') : undefined

      setStatus('Saving private draft…')
      setProcessing('Saving your artwork…')
      const databaseResponse = await fetch('/api/designs/draft', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: savedDesignId.current ?? undefined,
          name: 'Untitled design',
          design,
          previews: { front: front.preview, ...(back ? { back: back.preview } : {}) },
          production: { front: front.production, ...(back ? { back: back.production } : {}) },
          templateId,
          productId: requestedProductId,
          variantId: requestedSizeId,
        }),
      })
      const databasePayload = await databaseResponse.json()
      if (databaseResponse.ok) {
        savedDesignId.current =
          databasePayload.data?.design?.id ??
          databasePayload.design?.id ??
          savedDesignId.current
      }
      setStatus(databaseResponse.ok
        ? `Private draft saved ${new Date().toLocaleTimeString()}`
        : databasePayload.error?.message || 'Private design could not be saved.')
      return databaseResponse.ok ? savedDesignId.current : null
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Private design could not be saved.')
      return null
    } finally { busyRef.current = false; setProcessing(null) }
  }, [requestedProductId, requestedSizeId, session?.user, templateId])

  const switchSide = useCallback(async (next: 'front' | 'back') => {
    const canvas = canvasRef.current
    if (!canvas || next === currentSideRef.current) return
    sideStatesRef.current[currentSideRef.current] = canvas.toJSON()
    currentSideRef.current = next
    setCurrentSide(next)
    activateTemplateSide(next)
    const saved = sideStatesRef.current[next]
    if (saved) {
      await runWhileRestoring(() => canvas.loadFromJSON(saved))
      const fixedLayer = (canvas.getObjects() as EditorObject[]).find(isFixedLayer)
      flagGuideRefs.current = templateKindRef.current === 'flag' && fixedLayer ? await createFlagCanvasGuides(fixedLayer, configRef.current) : []
    }
    else {
      await restoreOriginalAtSize(configRef.current)
      sideStatesRef.current[next] = canvas.toJSON()
    }
    refreshObjects(); if (!saved) reset(); canvas.requestRenderAll(); setStatus(`Designing the ${next} side${sideTemplateSourcesRef.current[next]?.name ? ` · ${sideTemplateSourcesRef.current[next]!.name}` : ''}`)
  }, [activateTemplateSide, refreshObjects, reset, restoreOriginalAtSize, runWhileRestoring])

  const continueFromEditor = useCallback(async () => {
    sideStatesRef.current[currentSideRef.current] = canvasRef.current?.toJSON()
    if (configRef.current.sideMode === 'double' && !sideStatesRef.current.back) { setStatus('Create or copy the Back artwork before continuing with this double-sided product.'); return }
    const customizationRef = await save()
    if (requestedProductId) {
      const params = new URLSearchParams()
      if (!customizationRef || customizationRef.startsWith('local:')) { setStatus('Sign in and save your draft before generating a production preview.'); return }
      if (requestedSizeId) params.set('sizeId', requestedSizeId)
      if (requestedDesignType) params.set('designType', requestedDesignType)
      if (templateId) params.set('templateId', templateId)
      params.set('designId', customizationRef)
      params.set('productId', requestedProductId)
      router.push(`/design/preview?${params}`)
    } else {
      router.push('/products')
    }
  }, [requestedDesignType, requestedProductId, requestedSizeId, router, save, templateId])

  const exportOutput = useCallback(async (format: 'preview' | 'pdf' | 'svg') => {
    const canvas = canvasRef.current
    if (!canvas || busyRef.current) return
    busyRef.current = true
    setProcessing(format === 'preview' ? 'Rendering your preview…' : `Preparing your print-ready ${format.toUpperCase()}…`)
    try {
      const oldZoom = canvas.getZoom(), oldWidth = canvas.getWidth(), oldHeight = canvas.getHeight()
      guidesEnabledRef.current = false
      canvas.discardActiveObject(); canvas.setZoom(1); canvas.setDimensions({ width: configRef.current.logicalCanvasWidth, height: configRef.current.logicalCanvasHeight }); canvas.requestRenderAll()
      const canvasJson = canvas.toJSON() as Record<string, unknown>
      const originalData = format === 'preview' ? canvas.toDataURL({ format: 'png', multiplier: 2 }) : ''
      canvas.setDimensions({ width: oldWidth, height: oldHeight }); canvas.setZoom(oldZoom); guidesEnabledRef.current = guides; canvas.requestRenderAll()
      if (format === 'preview') { const data = await addWatermark(originalData); const preview = window.open('', '_blank', 'noopener,noreferrer'); if (preview) preview.document.write(`<title>Design Preview</title><img alt="Design preview" style="max-width:100%;height:auto" src="${data}">`) }
      else { const production = await renderProductionFiles(canvasJson, configRef.current); downloadProductionFile(production[format], `alibaba-signs-${Date.now()}.${format}`) }
    } catch (error) { setStatus(error instanceof Error ? error.message : 'The design export failed.') }
    finally { busyRef.current = false; setProcessing(null) }
  }, [guides])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (target.matches('input, textarea, select') || target.isContentEditable) return
      const command = event.ctrlKey || event.metaKey
      if (command && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        void (event.shiftKey ? redo() : undo())
      } else if (command && event.key.toLowerCase() === 'y') {
        event.preventDefault(); void redo()
      } else if (command && event.key.toLowerCase() === 'd') {
        event.preventDefault(); void duplicateSelected()
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault(); deleteSelected()
      } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        const object = canvasRef.current?.getActiveObject() as EditorObject | undefined
        if (!object || object.locked) return
        event.preventDefault()
        const amount = event.shiftKey ? 10 : 1
        object.set({
          left: (object.left ?? 0) + (event.key === 'ArrowRight' ? amount : event.key === 'ArrowLeft' ? -amount : 0),
          top: (object.top ?? 0) + (event.key === 'ArrowDown' ? amount : event.key === 'ArrowUp' ? -amount : 0),
        })
        object.setCoords()
        canvasRef.current?.requestRenderAll()
        scheduleSnapshot(120)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [deleteSelected, duplicateSelected, redo, scheduleSnapshot, undo])

  return (
    <div className="flex h-[calc(100vh-5rem)] min-h-[620px] flex-col overflow-hidden bg-white text-zinc-900">
      <EditorHeader canUndo={canUndo} canRedo={canRedo} status={status} disabled={Boolean(processing)} onUndo={() => void undo()} onRedo={() => void redo()} onSave={() => void save()} onPreview={() => void exportOutput('preview')} onDownloadPdf={() => void exportOutput('pdf')} onDownloadSvg={() => void exportOutput('svg')} onContinue={() => void continueFromEditor()} />
      <div className="flex min-h-0 flex-1">
        <EditorSidebar active={active} onChange={setActive} />
        <EditorPanels
          active={active}
          productConfig={productConfig}
          productSizeLocked={Boolean(requestedTemplateId && requestedSizeId)}
          objects={objects}
          selected={selected}
          onProductChange={changeProduct}
          onTemplate={(item) => void loadTemplate(item)}
          onAddText={addText}
          onUpload={(file) => void upload(file)}
          onGraphic={(path, name) => void addGraphic(path, name)}
          onBackground={(color) => { canvasRef.current?.set({ backgroundColor: color }); canvasRef.current?.requestRenderAll(); snapshot() }}
          onSelectLayer={(object) => { canvasRef.current?.setActiveObject(object); canvasRef.current?.requestRenderAll(); setSelected(object) }}
          onLayerAction={layerAction}
          onChangeSelected={changeSelected}
          onDuplicate={() => void duplicateSelected()}
          onDelete={deleteSelected}
        />
        <div className="relative flex min-w-0 flex-1"><CanvasWorkspace canvasRef={elementRef} workspaceRef={workspaceRef} guides={guides} zoom={zoom} productConfig={productConfig} onFit={() => fitToScreen()} onToggleGuides={() => { guidesEnabledRef.current = !guides; setGuides(!guides); canvasRef.current?.requestRenderAll() }} />{productConfig.sideMode === 'double' && <div className="absolute right-3 top-3 z-20 rounded-md border bg-white p-1 shadow"><p className="px-2 pb-1 text-[11px] font-semibold text-zinc-500">Design side</p><div className="flex gap-1"><button type="button" onClick={() => void switchSide('front')} aria-pressed={currentSide === 'front'} className={`rounded px-4 py-2 text-xs font-bold ${currentSide === 'front' ? 'bg-primary text-primary-foreground' : 'hover:bg-zinc-100'}`}>Front</button><button type="button" onClick={() => void switchSide('back')} aria-pressed={currentSide === 'back'} className={`rounded px-4 py-2 text-xs font-bold ${currentSide === 'back' ? 'bg-primary text-primary-foreground' : 'hover:bg-zinc-100'}`}>Back</button></div></div>}</div>
      </div>
      {processing && <div className="fixed inset-0 z-[100] grid place-items-center bg-white/55 backdrop-blur-[1px]" role="dialog" aria-modal="true" aria-live="polite"><div className="flex items-center gap-3 rounded-xl border bg-white/95 px-5 py-4 shadow-xl"><span className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-200 border-t-[#ed1b68]"/><p className="font-semibold">{processing}</p></div></div>}
    </div>
  )
}
