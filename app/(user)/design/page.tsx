import { Suspense } from 'react'
import CanvasEditorLoader from './CanvasEditorLoader'
import { RequireCustomerAuth } from '@/components/auth/require-customer-auth'

export default function DesignEditorPage() {
  return (
    <div className="w-full h-full bg-background">
      <RequireCustomerAuth><Suspense fallback={<div className="grid min-h-[70vh] place-items-center">Loading design editor…</div>}><CanvasEditorLoader /></Suspense></RequireCustomerAuth>
    </div>
  )
}
