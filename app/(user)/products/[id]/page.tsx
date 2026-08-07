'use client'

import { Suspense, use, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCart } from '@/lib/cart-context'
import { ArtworkUploadCard, type ArtworkSelection } from '@/components/products/artwork-upload-card'

interface Size { id: string; label: string; width: string | null; height: string | null; unit: string; unitPrice: string }
interface Product { id: string; name: string; description: string; basePrice: string; templateId: string | null; template: { id: string; name: string; status: string } | null; images: Array<{ id: string; url: string; alt: string | null; isPrimary: boolean }>; sizes: Size[] }

function ProductDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const customizationRef = searchParams.get('customizationRef')
  const requestedSizeId = searchParams.get('sizeId')
  const { addItem } = useCart()
  const [product, setProduct] = useState<Product | null>(null)
  const [sizeId, setSizeId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [imageIndex, setImageIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [artwork, setArtwork] = useState<ArtworkSelection | null>(null)
  useEffect(() => { void (async () => { try { const response = await fetch(`/api/products/${id}`); const payload = await response.json(); if (!response.ok) throw new Error(payload.error?.message || 'Product not found.'); setProduct(payload.data.product); setSizeId(payload.data.product.sizes.some((size: Size) => size.id === requestedSizeId) ? requestedSizeId! : payload.data.product.sizes[0]?.id || '') } catch (err) { setError(err instanceof Error ? err.message : 'The product could not be loaded.') } finally { setLoading(false) } })() }, [id, requestedSizeId])
  const selectedSize = useMemo(() => product?.sizes.find((size) => size.id === sizeId), [product, sizeId])
  function add() { if (!product || !selectedSize) return setError('Select an available size.'); setAdding(true); const designId = customizationRef && /^[0-9a-f-]{36}$/i.test(customizationRef) ? customizationRef : null; const designSource = artwork ? 'customer_upload' : customizationRef ? 'online_editor' : 'design_assistance'; addItem({ productId: product.id, productName: product.name, sizeId: selectedSize.id, sizeLabel: selectedSize.label, templateId: product.template?.id || null, templateName: product.template?.name || null, designId, customizationRef, artworkId: artwork?.id || null, designSource, quantity, price: Number(selectedSize.unitPrice), image: (product.images.find((image) => image.isPrimary) || product.images[0])?.url, specifications: { ...(customizationRef ? { customizationRef } : {}), designSource } }); router.push('/cart') }
  if (loading) return <div className="grid min-h-[70vh] place-items-center">Loading product…</div>
  if (!product) return <div className="grid min-h-[70vh] place-items-center text-center"><div><h1 className="text-2xl font-bold">Product unavailable</h1><p className="mt-2 text-muted-foreground">{error}</p><Link href="/products"><Button className="mt-5"><ArrowLeft /> Back to products</Button></Link></div></div>
  const image = product.images[imageIndex] || product.images[0]
  const unitPrice = Number(selectedSize?.unitPrice || product.basePrice)
return (
  <main className="min-h-screen bg-background">
    <div className="mx-auto max-w-7xl px-4 py-6">
      <Link href="/products" className="inline-flex items-center gap-2 text-sm font-semibold">
        <ArrowLeft className="h-4 w-4" /> Products
      </Link>

      <div className="mt-6 grid gap-10 md:grid-cols-2 items-start">
        {/* LEFT COLUMN: Images & Description */}
        <section className="space-y-6">
          {/* Main Image & Thumbnails */}
          <div>
            {image ? (
              <div className="overflow-hidden rounded-xl border bg-secondary">
                <img
                  src={image.url}
                  alt={image.alt || product.name}
                  className="h-[430px] w-full object-contain"
                />
              </div>
            ) : (
              <div className="grid h-[430px] place-items-center rounded-xl border bg-secondary text-muted-foreground">
                No product image
              </div>
            )}

            {product.images.length > 1 && (
              <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
                {product.images.map((item, index) => (
                  <button
                    key={item.id}
                    onClick={() => setImageIndex(index)}
                    className={`overflow-hidden rounded border-2 shrink-0 ${
                      index === imageIndex ? 'border-primary' : 'border-transparent'
                    }`}
                  >
                    <img src={item.url} alt="" className="h-20 w-20 object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Scrollable Description Box */}
          <div className="rounded-xl border p-5 bg-card">
            <h2 className="text-lg font-bold mb-3">Product Details</h2>
            <div
              className="prose max-w-none text-foreground max-h-[350px] overflow-y-auto pr-2"
              dangerouslySetInnerHTML={{ __html: product.description }}
            />
          </div>
        </section>

        {/* RIGHT COLUMN: Title, Pricing, Customization & Actions */}
        <section className="space-y-6">
          <div>
            <h1 className="text-4xl font-black">{product.name}</h1>
            <p className="mt-3 text-3xl font-black text-primary">
              ${unitPrice.toFixed(2)}{' '}
              <span className="text-sm font-normal text-muted-foreground">per unit</span>
            </p>
          </div>

          <div className="space-y-5 border-y py-6">
            {/* Size Selection */}
            <div>
              <Label htmlFor="size">Standard size</Label>
              <select
                id="size"
                value={sizeId}
                onChange={(e) => setSizeId(e.target.value)}
                className="mt-2 h-11 w-full rounded-md border bg-background px-3"
                required
              >
                {product.sizes.map((size) => (
                  <option key={size.id} value={size.id}>
                    {size.label} - ${Number(size.unitPrice).toFixed(2)}
                  </option>
                ))}
              </select>
              {selectedSize?.width && selectedSize.height && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {selectedSize.width} x {selectedSize.height} {selectedSize.unit}
                </p>
              )}
            </div>

            {/* Template Editor Link */}
            {product.template && selectedSize && (
              <div className="rounded-lg bg-secondary p-4">
                <p className="font-semibold">Editable design included</p>
                <p className="text-sm text-muted-foreground">{product.template.name}</p>
                <Link
                  href={`/design?templateId=${product.template.id}&productId=${product.id}&sizeId=${selectedSize.id}`}
                  className="mt-3 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                >
                  Edit Template
                </Link>
              </div>
            )}

            {/* Quantity */}
            <div>
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                max="1000"
                value={quantity}
                onChange={(e) =>
                  setQuantity(Math.min(1000, Math.max(1, Number(e.target.value) || 1)))
                }
                className="mt-2 w-28"
              />
            </div>
          </div>

          {/* Artwork Upload */}
          <ArtworkUploadCard
            productId={product.id}
            sizeId={selectedSize?.id || ''}
            quantity={quantity}
            value={artwork}
            onChange={setArtwork}
          />

          {/* Error Message */}
          {error && (
            <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          {/* Total Price & Checkout Action */}
          <div className="rounded-lg bg-primary/10 p-4">
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="h-5 w-5 text-primary" /> Total: ${(unitPrice * quantity).toFixed(2)}
            </div>
          </div>

          <Button
            size="lg"
            className="w-full"
            onClick={add}
            disabled={adding || !selectedSize}
          >
            {adding ? 'Adding…' : 'Add to cart'}
          </Button>
        </section>
      </div>
    </div>
  </main>
);
}

export default function ProductDetailPage(props: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<div className="grid min-h-[70vh] place-items-center">Loading product…</div>}><ProductDetailContent {...props} /></Suspense>
}
