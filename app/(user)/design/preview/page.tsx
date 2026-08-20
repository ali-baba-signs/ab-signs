'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'

export default function DesignPreviewPage() {
  const query = useSearchParams()
  const designId = query.get('designId')
  const productId = query.get('productId')
  const sizeId = query.get('sizeId')
  const templateId = query.get('templateId')
  if (!designId || !productId || !sizeId) return <main className="grid min-h-[60vh] place-items-center p-6"><p>Design preview details are missing. Return to the editor and save again.</p></main>
  const productUrl = `/products/${encodeURIComponent(productId)}?${new URLSearchParams({ sizeId, ...(templateId ? { templateId } : {}), customizationRef: designId })}`
  const editUrl = `/design?${new URLSearchParams({ productId, sizeId, ...(templateId ? { templateId } : {}) })}`
  return <main className="mx-auto max-w-5xl px-4 py-10"><h1 className="text-3xl font-black">Preview your design</h1><p className="mt-2 text-muted-foreground">This is the saved production preview. You can edit before adding it to your cart.</p><section className="mt-6 rounded-xl border bg-card p-5"><img src={`/api/designs/${encodeURIComponent(designId)}/preview`} alt="Saved design preview" className="mx-auto max-h-[65vh] max-w-full rounded border bg-white object-contain"/></section><div className="mt-6 flex flex-wrap gap-3"><Link href={editUrl}><Button variant="outline">Edit design</Button></Link><Link href={productUrl}><Button>Confirm design &amp; continue</Button></Link></div></main>
}
