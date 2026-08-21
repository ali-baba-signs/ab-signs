'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Canvas, FabricImage, FabricObject, Group, Textbox, loadSVGFromString, util,
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
import { renderBrowserSide, uploadBrowserRender } from '@/lib/editor/browser-preview'
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

function scaleComposition(canvas: Canvas, baseWidth: number, baseHeight: number, targetWidth: number, targetHeight: number, fitMode: 'contain' | 'cover' | 'stretch' = 'contain') {
  const scaleX = targetWidth / Math.max(1, baseWidth)
  const scaleY = targetHeight / Math.max(1, baseHeight)
  const uniform = fitMode === 'cover' ? Math.max(scaleX, scaleY) : Math.min(scaleX, scaleY)
  const objectScaleX = fitMode === 'stretch' ? scaleX : uniform
  const objectScaleY = fitMode === 'stretch' ? scaleY : uniform
  const offsetX = (targetWidth - baseWidth * objectScaleX) / 2
  const offsetY = (targetHeight - baseHeight * objectScaleY) / 2
  for (const object of canvas.getObjects()) {
    object.set({
      left: (object.left ?? 0) * objectScaleX + offsetX,
      top: (object.top ?? 0) * objectScaleY + offsetY,
      scaleX: (object.scaleX ?? 1) * objectScaleX,
      scaleY: (object.scaleY ?? 1) * objectScaleY,
    })
    object.setCoords()
  }
}

export function CanvasEditor() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestedTemplateId = searchParams.get('templateId')
  const requestedProductId = searchParams.get('productId')
  const requestedSizeId = searchParams.get('sizeId')
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
  const [currentSide, setCurrentSide] = useState<'front' | 'back'>('front')
  const currentSideRef = useRef<'front' | 'back'>('front')
  const sideStatesRef = useRef<Partial<Record<'front' | 'back', Record<string, unknown>>>>({})
  const savedDesignId = useRef<string | null>(null)
  const originalTemplateRef = useRef<Record<string, unknown> | null>(null)
  const baseCanvasRef = useRef({ width: DEFAULT_PRODUCT_CONFIG.logicalCanvasWidth, height: DEFAULT_PRODUCT_CONFIG.logicalCanvasHeight, fitMode: 'contain' as 'contain' | 'cover' | 'stretch' })
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
    setObjects((canvasRef.current?.getObjects() ?? []) as EditorObject[])
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

  const restoreOriginalAtSize = useCallback(async (config: ProductConfig) => {
    const canvas = canvasRef.current
    const original = originalTemplateRef.current
    if (!canvas || !original) return
    canvas.renderOnAddRemove = false
    try {
      await runWhileRestoring(async () => {
        await canvas.loadFromJSON(original)
        unpackSvgRoot(canvas)
        scaleComposition(canvas, baseCanvasRef.current.width, baseCanvasRef.current.height, config.logicalCanvasWidth, config.logicalCanvasHeight, baseCanvasRef.current.fitMode)
        canvas.setDimensions({ width: config.logicalCanvasWidth, height: config.logicalCanvasHeight })
      })
    } finally { canvas.renderOnAddRemove = true }
    canvas.requestRenderAll()
  }, [runWhileRestoring])

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
          const response = await fetch(`/api/templates/${requestedTemplateId}/editor-data?${params}`, { cache: 'no-store' })
          const payload = await response.json()
          if (!response.ok) throw new Error(payload.error?.message || 'The selected template could not be loaded.')
          configRef.current = payload.data.productConfig
          setProductConfig(payload.data.productConfig)
          setTemplateId(payload.data.template.id)
          originalTemplateRef.current = payload.data.template.canvasData
          baseCanvasRef.current = { width: payload.data.template.baseCanvasWidth, height: payload.data.template.baseCanvasHeight, fitMode: payload.data.fitMode || 'contain' }
          await restoreOriginalAtSize(payload.data.productConfig)
          sideStatesRef.current.front = canvas.toJSON()
          setStatus(`${payload.data.template.name} loaded for ${payload.data.productSize?.label || 'its fixed size'}`)
        } else if (saved) {
          configRef.current = saved.productConfig
          setProductConfig(saved.productConfig)
          setTemplateId(saved.templateId)
          await runWhileRestoring(() => canvas.loadFromJSON(saved.canvasJson))
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
  }, [drawGuides, fitToScreen, refreshObjects, requestedProductId, requestedSizeId, requestedTemplateId, reset, restoreOriginalAtSize, runWhileRestoring, scheduleSnapshot, snapshot])

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
      router.push(`/design?templateId=${encodeURIComponent(template.id)}&productId=${encodeURIComponent(template.productId)}&sizeId=${encodeURIComponent(template.sizeId)}`)
      return
    }
    const canvas = canvasRef.current
    if (!canvas) return
    setStatus('Loading template…')
    try {
      const loaded = await fetchTemplate(template)
      canvas.discardActiveObject()
      originalTemplateRef.current = loaded.json
      baseCanvasRef.current = { width: template.width, height: template.height, fitMode: loaded.fitMode }
      const config = loaded.productConfig || configRef.current
      configRef.current = config
      setProductConfig(config)
      await restoreOriginalAtSize(config)
      for (const object of canvas.getObjects() as EditorObject[]) {
        if (!object.id) object.set({ id: crypto.randomUUID() })
        if (object.locked) applyLock(object, true)
      }
      setTemplateId(template.id)
      refreshObjects()
      reset()
      canvas.requestRenderAll()
      setStatus(`${template.name} loaded`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Template failed to load')
    }
  }, [canUndo, refreshObjects, requestedProductId, requestedSizeId, requestedTemplateId, reset, restoreOriginalAtSize, router])

  const upload = useCallback(async (file: File) => {
    if (!ALLOWED_UPLOADS.has(file.type)) return setStatus('Unsupported image type')
    if (file.size > MAX_UPLOAD_BYTES) return setStatus('Image is larger than 10 MB')
    const canvas = canvasRef.current
    if (!canvas) return
    let assetKey: string | undefined
    if (session?.user && file.type !== 'image/svg+xml') {
      const presignResponse = await fetch('/api/uploads/presign', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          size: file.size,
          purpose: 'design-artwork',
        }),
      })
      const presignPayload = await presignResponse.json()
      if (presignResponse.ok) {
        const uploadResponse = await fetch(presignPayload.data.uploadUrl, {
          method: 'PUT',
          headers: { 'content-type': file.type },
          body: file,
        })
        if (uploadResponse.ok) assetKey = presignPayload.data.key
      }
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(new Error('Unable to read image'))
      reader.readAsDataURL(file)
    })
    let object: EditorObject
    if (file.type === 'image/svg+xml') {
      const text = await file.text()
      if (/<script|javascript:|https?:\/\//i.test(text)) return setStatus('Unsafe SVG was rejected')
      const parsed = await loadSVGFromString(text)
      object = util.groupSVGElements(parsed.objects.filter(Boolean) as FabricObject[], parsed.options) as EditorObject
    } else {
      object = await FabricImage.fromURL(dataUrl) as EditorObject
    }
    const maxWidth = configRef.current.logicalCanvasWidth * 0.45
    if ((object.width ?? 1) > maxWidth) object.scaleToWidth(maxWidth)
    object.set({ left: 100, top: 100, id: crypto.randomUUID(), name: file.name, role: 'uploaded-image', assetKey })
    canvas.add(object)
    canvas.setActiveObject(object)
    canvas.requestRenderAll()
  }, [session?.user])

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
    if (!canvas) return
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
    if (!canvas) return
    sideStatesRef.current[currentSideRef.current] = canvas.toJSON()
    const sides = configRef.current.sideMode === 'double' && sideStatesRef.current.front ? { front: { canvasJson: sideStatesRef.current.front }, ...(sideStatesRef.current.back ? { back: { canvasJson: sideStatesRef.current.back } } : {}) } : undefined
    const design = serializeDesign(canvas, configRef.current, templateId, sides)
    saveDesign(design)
    if (!session?.user) {
      setStatus('Saved temporarily on this device. Sign in to save a private draft.')
      return `local:${templateId || 'blank'}:${Date.now()}`
    }

    try {
      setStatus('Rendering production preview…')
      const renderGroupId = savedDesignId.current ?? crypto.randomUUID()
      const renderAndUpload = async (canvasJson: Record<string, unknown>, side: 'front' | 'back') => {
        const rendered = await renderBrowserSide(canvasJson, configRef.current)
        const [preview, production] = await Promise.all([
          uploadBrowserRender(rendered.preview, `${side}-preview.png`, renderGroupId),
          uploadBrowserRender(rendered.production, `${side}-production.jpg`, renderGroupId),
        ])
        return { preview, production }
      }
      const frontJson = sides?.front.canvasJson ?? design.canvasJson
      const front = await renderAndUpload(frontJson, 'front')
      // Match the previous server renderer: an untouched back side starts from
      // the front state until the customer explicitly edits it.
      const back = configRef.current.sideMode === 'double'
        ? await renderAndUpload(sides?.back?.canvasJson ?? frontJson, 'back')
        : undefined

      setStatus('Saving private draft…')
      const databaseResponse = await fetch('/api/designs/draft', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: savedDesignId.current ?? undefined,
          name: 'Untitled design',
          design,
          previews: { front, ...(back ? { back } : {}) },
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
    }
  }, [requestedProductId, requestedSizeId, session?.user, templateId])

  const switchSide = useCallback(async (next: 'front' | 'back') => {
    const canvas = canvasRef.current
    if (!canvas || next === currentSideRef.current) return
    sideStatesRef.current[currentSideRef.current] = canvas.toJSON()
    currentSideRef.current = next
    setCurrentSide(next)
    const saved = sideStatesRef.current[next]
    if (saved) await runWhileRestoring(() => canvas.loadFromJSON(saved))
    else {
      await restoreOriginalAtSize(configRef.current)
      sideStatesRef.current[next] = canvas.toJSON()
    }
    refreshObjects(); if (!saved) reset(); canvas.requestRenderAll(); setStatus(`${next === 'front' ? 'Front' : 'Back'} side selected`)
  }, [refreshObjects, reset, restoreOriginalAtSize, runWhileRestoring])

  const copyFrontToBack = useCallback(async (mirror: boolean) => {
    const canvas = canvasRef.current
    if (!canvas) return
    sideStatesRef.current[currentSideRef.current] = canvas.toJSON()
    const front = sideStatesRef.current.front
    if (!front) return
    currentSideRef.current = 'back'; setCurrentSide('back')
    await runWhileRestoring(() => canvas.loadFromJSON(front))
    if (mirror) for (const object of canvas.getObjects()) { object.set({ left: configRef.current.logicalCanvasWidth - (object.left ?? 0), flipX: !object.flipX }); object.setCoords() }
    sideStatesRef.current.back = canvas.toJSON(); refreshObjects(); reset(); canvas.requestRenderAll(); setStatus(mirror ? 'Front mirrored to back by request' : 'Front copied to back by request')
  }, [refreshObjects, reset, runWhileRestoring])

  const continueFromEditor = useCallback(async () => {
    sideStatesRef.current[currentSideRef.current] = canvasRef.current?.toJSON()
    if (configRef.current.sideMode === 'double' && !sideStatesRef.current.back) { setStatus('Create or copy the Back artwork before continuing with this double-sided product.'); return }
    const customizationRef = await save()
    if (requestedProductId) {
      const params = new URLSearchParams()
      if (!customizationRef || customizationRef.startsWith('local:')) { setStatus('Sign in and save your draft before generating a production preview.'); return }
      if (requestedSizeId) params.set('sizeId', requestedSizeId)
      if (templateId) params.set('templateId', templateId)
      params.set('designId', customizationRef)
      params.set('productId', requestedProductId)
      router.push(`/design/preview?${params}`)
    } else {
      router.push('/products')
    }
  }, [requestedProductId, requestedSizeId, router, save, templateId])

  const exportPng = useCallback(async (download: boolean) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const oldZoom = canvas.getZoom()
    const oldWidth = canvas.getWidth()
    const oldHeight = canvas.getHeight()
    guidesEnabledRef.current = false
    canvas.discardActiveObject()
    canvas.setZoom(1)
    canvas.setDimensions({ width: configRef.current.logicalCanvasWidth, height: configRef.current.logicalCanvasHeight })
    canvas.requestRenderAll()
    const originalData = canvas.toDataURL({ format: 'png', multiplier: 2 })
    canvas.setDimensions({ width: oldWidth, height: oldHeight })
    canvas.setZoom(oldZoom)
    guidesEnabledRef.current = guides
    canvas.requestRenderAll()
    const data = download ? originalData : await addWatermark(originalData)
    if (download) {
      const link = document.createElement('a')
      link.download = `alibaba-signs-${Date.now()}.png`
      link.href = data
      link.click()
    } else {
      const preview = window.open('', '_blank', 'noopener,noreferrer')
      if (preview) preview.document.write(`<title>Design Preview</title><img alt="Design preview" style="max-width:100%;height:auto" src="${data}">`)
    }
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
      <EditorHeader canUndo={canUndo} canRedo={canRedo} status={status} onUndo={() => void undo()} onRedo={() => void redo()} onSave={() => void save()} onPreview={() => void exportPng(false)} onDownload={() => void exportPng(true)} onContinue={() => void continueFromEditor()} />
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
        <div className="relative flex min-w-0 flex-1"><CanvasWorkspace canvasRef={elementRef} workspaceRef={workspaceRef} guides={guides} zoom={zoom} productConfig={productConfig} onFit={() => fitToScreen()} onToggleGuides={() => { guidesEnabledRef.current = !guides; setGuides(!guides); canvasRef.current?.requestRenderAll() }} />{productConfig.sideMode === 'double' && <div className="absolute right-3 top-3 z-20 flex flex-wrap gap-1 rounded-md border bg-white p-1 shadow"><button type="button" onClick={() => void switchSide('front')} className={`rounded px-3 py-1.5 text-xs font-bold ${currentSide === 'front' ? 'bg-primary text-primary-foreground' : ''}`}>Front</button><button type="button" onClick={() => void switchSide('back')} className={`rounded px-3 py-1.5 text-xs font-bold ${currentSide === 'back' ? 'bg-primary text-primary-foreground' : ''}`}>Back</button><button type="button" onClick={() => void copyFrontToBack(false)} className="rounded border px-2 py-1.5 text-xs">Copy front</button><button type="button" onClick={() => void copyFrontToBack(true)} className="rounded border px-2 py-1.5 text-xs">Mirror front</button></div>}</div>
      </div>
    </div>
  )
}
