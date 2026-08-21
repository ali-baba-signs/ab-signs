'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ImagePlus, Move, Scissors } from 'lucide-react'
import { Button } from '@/components/ui/button'

type ImageCropUploadProps = {
  label: string
  recommendedWidth: number
  recommendedHeight: number
  value?: string
  optional?: boolean
  disabled?: boolean
  onCropped: (file: File, previewUrl: string) => void | Promise<void>
}

type ImageSize = { width: number; height: number }
type Point = { x: number; y: number }

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum)
}

export function ImageCropUpload({ label, recommendedWidth, recommendedHeight, value, optional, disabled, onCropped }: ImageCropUploadProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ pointerId: number; start: Point; origin: Point } | null>(null)
  const [sourceUrl, setSourceUrl] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const [fileName, setFileName] = useState('image')
  const [imageSize, setImageSize] = useState<ImageSize>({ width: 0, height: 0 })
  const [stageSize, setStageSize] = useState<ImageSize>({ width: 0, height: 0 })
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 })
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const targetRatio = recommendedWidth / recommendedHeight

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const update = () => setStageSize({ width: stage.clientWidth, height: stage.clientHeight })
    update()
    const observer = new ResizeObserver(update)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [sourceUrl])

  useEffect(() => () => { if (sourceUrl.startsWith('blob:')) URL.revokeObjectURL(sourceUrl) }, [sourceUrl])
  useEffect(() => () => { if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  const cropMetrics = useMemo(() => {
    if (!imageSize.width || !stageSize.width) return { scale: 1, maxX: 0, maxY: 0 }
    const baseScale = Math.max(stageSize.width / imageSize.width, stageSize.height / imageSize.height)
    const scale = baseScale * zoom
    return {
      scale,
      maxX: Math.max(0, (imageSize.width * scale - stageSize.width) / 2),
      maxY: Math.max(0, (imageSize.height * scale - stageSize.height) / 2),
    }
  }, [imageSize, stageSize, zoom])

  const safeOffset = { x: clamp(offset.x, -cropMetrics.maxX, cropMetrics.maxX), y: clamp(offset.y, -cropMetrics.maxY, cropMetrics.maxY) }

  const mismatch = imageSize.width > 0 && Math.abs((imageSize.width / imageSize.height) - targetRatio) / targetRatio > 0.02

  function choose(file?: File) {
    if (!file) return
    if (!file.type.startsWith('image/')) return setError('Choose a PNG, JPEG, or WebP image.')
    if (sourceUrl.startsWith('blob:')) URL.revokeObjectURL(sourceUrl)
    const nextUrl = URL.createObjectURL(file)
    setSourceUrl(nextUrl)
    setFileName(file.name.replace(/\.[^.]+$/, '') || 'image')
    setImageSize({ width: 0, height: 0 })
    setZoom(1)
    setOffset({ x: 0, y: 0 })
    setError('')
  }

  function move(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    setOffset({
      x: clamp(drag.origin.x + event.clientX - drag.start.x, -cropMetrics.maxX, cropMetrics.maxX),
      y: clamp(drag.origin.y + event.clientY - drag.start.y, -cropMetrics.maxY, cropMetrics.maxY),
    })
  }

  async function applyCrop() {
    if (!sourceUrl || !imageSize.width || !stageSize.width) return
    setProcessing(true)
    setError('')
    try {
      const image = new Image()
      image.src = sourceUrl
      await image.decode()
      const displayedWidth = imageSize.width * cropMetrics.scale
      const displayedHeight = imageSize.height * cropMetrics.scale
      const left = (stageSize.width - displayedWidth) / 2 + safeOffset.x
      const top = (stageSize.height - displayedHeight) / 2 + safeOffset.y
      const sourceX = clamp(-left / cropMetrics.scale, 0, imageSize.width)
      const sourceY = clamp(-top / cropMetrics.scale, 0, imageSize.height)
      const sourceWidth = Math.min(stageSize.width / cropMetrics.scale, imageSize.width - sourceX)
      const sourceHeight = Math.min(stageSize.height / cropMetrics.scale, imageSize.height - sourceY)
      const canvas = document.createElement('canvas')
      canvas.width = recommendedWidth
      canvas.height = recommendedHeight
      const context = canvas.getContext('2d')
      if (!context) throw new Error('This browser cannot prepare the crop.')
      context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, recommendedWidth, recommendedHeight)
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.9))
      if (!blob) throw new Error('The cropped image could not be created.')
      const file = new File([blob], `${fileName}-${recommendedWidth}x${recommendedHeight}.webp`, { type: 'image/webp', lastModified: Date.now() })
      if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
      const nextPreview = URL.createObjectURL(blob)
      setPreviewUrl(nextPreview)
      await onCropped(file, nextPreview)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The image could not be cropped.')
    } finally {
      setProcessing(false)
    }
  }

  return <div className="rounded-lg border bg-muted/20 p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-sm font-semibold">{label}{optional ? ' (optional)' : ''}</p>
        <p className="mt-1 text-xs text-muted-foreground">Recommended {recommendedWidth} × {recommendedHeight}px ({recommendedWidth / recommendedHeight >= 1 ? 'landscape' : 'portrait'}). Choose an image, drag it inside the display area, zoom, then apply the crop.</p>
      </div>
      <label className={`inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-xs font-semibold ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
        <ImagePlus className="h-4 w-4" /> {sourceUrl ? 'Choose another' : 'Choose image'}
        <input disabled={disabled} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => { choose(event.target.files?.[0]); event.currentTarget.value = '' }} />
      </label>
    </div>

    {sourceUrl && <div className="mt-4 space-y-3">
      {mismatch && <p role="alert" className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">This image does not match the recommended ratio. Adjust the crop before uploading.</p>}
      <div
        ref={stageRef}
        className="relative w-full touch-none cursor-grab overflow-hidden rounded-md bg-zinc-900 active:cursor-grabbing"
        style={{ aspectRatio: `${recommendedWidth} / ${recommendedHeight}`, maxHeight: 420 }}
        onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); dragRef.current = { pointerId: event.pointerId, start: { x: event.clientX, y: event.clientY }, origin: safeOffset } }}
        onPointerMove={move}
        onPointerUp={(event) => { if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null }}
        onPointerCancel={() => { dragRef.current = null }}
      >
        <img
          src={sourceUrl}
          alt="Crop source"
          draggable={false}
          onLoad={(event) => setImageSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
          className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
          style={{ width: imageSize.width ? imageSize.width * cropMetrics.scale : 'auto', height: imageSize.height ? imageSize.height * cropMetrics.scale : 'auto', transform: `translate(calc(-50% + ${safeOffset.x}px), calc(-50% + ${safeOffset.y}px))` }}
        />
        <div className="pointer-events-none absolute inset-0 border-2 border-dashed border-white/90 shadow-[inset_0_0_0_9999px_rgba(0,0,0,0.08)]" />
        <span className="pointer-events-none absolute left-2 top-2 inline-flex items-center gap-1 rounded bg-black/65 px-2 py-1 text-[11px] font-semibold text-white"><Move className="h-3 w-3" /> Crop boundary / display area</span>
      </div>
      <label className="flex items-center gap-3 text-xs font-semibold">Zoom
        <input aria-label={`${label} zoom`} className="w-full accent-primary" type="range" min="1" max="3" step="0.01" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} />
        <span className="w-10 text-right">{zoom.toFixed(1)}×</span>
      </label>
      <Button type="button" size="sm" disabled={processing || !imageSize.width} onClick={() => void applyCrop()}><Scissors className="h-4 w-4" /> {processing ? 'Preparing…' : 'Apply crop & upload'}</Button>
    </div>}

    {(previewUrl || value) && <div className="mt-4"><p className="mb-2 text-xs font-semibold">Final preview</p><img src={previewUrl || value} alt={`${label} final preview`} className="max-h-48 w-full rounded-md border bg-white object-contain" style={{ aspectRatio: `${recommendedWidth} / ${recommendedHeight}` }} /></div>}
    {error && <p role="alert" className="mt-3 text-xs font-semibold text-red-600">{error}</p>}
  </div>
}
