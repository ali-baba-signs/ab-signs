'use client'

import { Suspense } from 'react'
import { CanvasEditor } from '@/components/editor/canvas-editor'

export default function DesignEditorPage() {
  return (
    <div className="w-full h-full bg-background">
      <Suspense fallback={<div className="grid min-h-[70vh] place-items-center">Loading design editor…</div>}><CanvasEditor /></Suspense>
    </div>
  )
}
