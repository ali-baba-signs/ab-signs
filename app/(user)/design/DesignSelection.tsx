'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { designSelectionsForProductionSize, uniqueProductionSizes, type SizeDesignConfiguration } from '@/lib/products/design-configurations'

type Size = { id: string; label: string; enabled: boolean; width: string; height: string; unit: string; sideMode: string; designConfigurations: SizeDesignConfiguration[] }
type Product = { id: string; name: string; sizes: Size[]; templates: { id: string; name: string; status: string; conversionStatus: string; previewImageUrl: string | null; compatibleSizeIds: string[] }[] }

export default function DesignSelection() {
  const params = useSearchParams()
  const [products, setProducts] = useState<Product[]>([])
  const [productId, setProductId] = useState(params.get('productId') || '')
  const [sizeId, setSizeId] = useState(params.get('sizeId') || '')
  const [state, setState] = useState('Loading products…')
  useEffect(() => {
    const controller = new AbortController()
    void fetch('/api/products?limit=100', { signal: controller.signal, cache: 'no-store' }).then(async (response) => {
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error?.message || 'Products could not be loaded.')
      setProducts(payload.data.products)
      setState('')
    }).catch((error) => { if (!controller.signal.aborted) setState(error.message) })
    return () => controller.abort()
  }, [])
  const product = products.find((row) => row.id === productId)
  const sizes = product?.sizes.filter((size) => size.enabled) || []
  const selectedSize = sizes.find((size) => size.id === sizeId)
  const selections = selectedSize ? designSelectionsForProductionSize(selectedSize, sizes) : []
  const available = selections.flatMap(({ size, configuration }) => {
    const id = configuration.designType === 'double_side' ? configuration.frontTemplateId : configuration.singleTemplateId
    const template = product?.templates.find((row) => row.id === id && row.status === 'active' && row.conversionStatus === 'ready' && row.compatibleSizeIds.includes(size.id))
    return template ? [{ template, size, configuration }] : []
  })
  return <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">
    <h1 className="text-3xl font-bold">Design Your Signage</h1>
    <p className="mt-3 text-muted-foreground">Choose a product and production size to see its available designs.</p>
    {state && <p role="status" className="mt-4">{state}</p>}
    <div className="my-8 grid gap-4 sm:grid-cols-2">
      <label className="min-w-0 font-semibold">Product<select className="mt-2 h-12 w-full min-w-0 rounded-md border bg-background px-3" value={productId} onChange={(event) => { setProductId(event.target.value); setSizeId('') }}><option value="">Select a product</option>{products.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
      <label className="min-w-0 font-semibold">Production size<select className="mt-2 h-12 w-full min-w-0 rounded-md border bg-background px-3" disabled={!product} value={sizeId} onChange={(event) => setSizeId(event.target.value)}><option value="">Select a production size</option>{uniqueProductionSizes(sizes).map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}</select></label>
    </div>
    {selectedSize && !available.length && <p>No editable templates are assigned to this size. Please select another size or contact us for design assistance.</p>}
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{available.map(({ template, size, configuration }) => <article key={`${size.id}-${configuration.designType}`} className="min-w-0 overflow-hidden rounded-xl border">
      {template.previewImageUrl && <img src={template.previewImageUrl} alt={template.name} className="aspect-[4/3] w-full object-contain p-4" />}
      <div className="p-4"><h2 className="break-words text-lg font-bold">{template.name}</h2><p className="mt-1 text-sm">{configuration.designType === 'double_side' ? 'Double sided' : 'Single sided'} · {size.label}</p>
      <Link className="mt-4 inline-flex min-h-11 items-center rounded-md bg-primary px-5 py-2 font-semibold text-primary-foreground" href={`/design?${new URLSearchParams({ productId, sizeId: size.id, templateId: template.id, designType: configuration.designType })}`}>Open editor</Link></div>
    </article>)}</div>
  </main>
}
