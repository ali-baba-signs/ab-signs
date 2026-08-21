'use client'

import dynamic from 'next/dynamic'

const CanvasEditor = dynamic(
  () => import('@/components/editor/canvas-editor').then((module) => module.CanvasEditor),
  {
    ssr: false,
    loading: () => <div className="grid min-h-[70vh] place-items-center">Loading design editor…</div>,
  },
)

export default function CanvasEditorLoader() {
  return <CanvasEditor />
}
