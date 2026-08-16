'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Canvas, FabricObject } from 'fabric'

const HISTORY_LIMIT = 50
type HistoryEntry = { json: string; selectedId: string | null }

export function useCanvasHistory(canvasRef: React.RefObject<Canvas | null>) {
  const entries = useRef<HistoryEntry[]>([])
  const index = useRef(-1)
  const restoring = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [state, setState] = useState({ canUndo: false, canRedo: false })

  const sync = useCallback(() => setState({ canUndo: index.current > 0, canRedo: index.current >= 0 && index.current < entries.current.length - 1 }), [])
  const snapshot = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || restoring.current) return
    const json = JSON.stringify(canvas.toJSON())
    if (entries.current[index.current]?.json === json) return
    const selectedId = (canvas.getActiveObject() as FabricObject & { id?: string } | undefined)?.id || null
    entries.current = entries.current.slice(0, index.current + 1)
    entries.current.push({ json, selectedId })
    if (entries.current.length > HISTORY_LIMIT) entries.current.shift()
    index.current = entries.current.length - 1
    sync()
  }, [canvasRef, sync])
  const scheduleSnapshot = useCallback((delay = 250) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(snapshot, delay)
  }, [snapshot])
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  const reset = useCallback(() => { entries.current = []; index.current = -1; snapshot() }, [snapshot])
  const restore = useCallback(async (nextIndex: number) => {
    const canvas = canvasRef.current
    const entry = entries.current[nextIndex]
    if (!canvas || !entry || nextIndex < 0 || nextIndex >= entries.current.length) return
    restoring.current = true
    try {
      canvas.discardActiveObject()
      await canvas.loadFromJSON(entry.json)
      const selected = entry.selectedId ? canvas.getObjects().find((object) => (object as FabricObject & { id?: string }).id === entry.selectedId) : null
      if (selected) canvas.setActiveObject(selected)
      canvas.requestRenderAll()
      index.current = nextIndex
    } finally { restoring.current = false; sync() }
  }, [canvasRef, sync])
  const runWhileRestoring = useCallback(async <T,>(task: () => Promise<T>) => {
    restoring.current = true
    try { return await task() } finally { restoring.current = false }
  }, [])
  // Keep these identities stable. CanvasEditor uses them in its one-time Fabric
  // initialisation effect; fresh lambdas here caused the canvas to be disposed
  // and recreated after history state changes.
  const undo = useCallback(() => restore(index.current - 1), [restore])
  const redo = useCallback(() => restore(index.current + 1), [restore])
  return { ...state, runWhileRestoring, isRestoring: restoring, snapshot, scheduleSnapshot, reset, undo, redo }
}
