'use client'

import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import DesignSelection from './DesignSelection'

const CanvasEditor = dynamic(
  () => import('@/components/editor/canvas-editor').then((module) => module.CanvasEditor),
  {
    ssr: false,
    loading: () => <div className="grid min-h-[70vh] place-items-center">Loading design editor…</div>,
  },
)

export default function CanvasEditorLoader() {
  const params = useSearchParams()
  if (!params.get('templateId') || !params.get('productId') || !params.get('sizeId')) return <DesignSelection />
  return <CanvasEditor key={params.toString()} />
}

