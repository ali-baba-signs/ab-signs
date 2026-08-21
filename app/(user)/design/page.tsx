import { Suspense } from 'react'
import CanvasEditorLoader from './CanvasEditorLoader'

export default function DesignEditorPage() {
  return (
    <div className="w-full h-full bg-background">
      <Suspense fallback={<div className="grid min-h-[70vh] place-items-center">Loading design editor…</div>}><CanvasEditorLoader /></Suspense>
    </div>
  )
}
