import { Suspense } from 'react'
import PreviewContent from './PreviewContent'

export default function DesignPreviewPage() {
  return <Suspense fallback={<div className="grid min-h-[60vh] place-items-center p-6">Loading preview...</div>}><PreviewContent /></Suspense>
}
