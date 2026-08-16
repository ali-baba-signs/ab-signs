'use client'

import { Suspense, use, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, CheckCircle2,Star} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCart } from '@/lib/cart-context'
import { ArtworkUploadCard, type ArtworkSelection } from '@/components/products/artwork-upload-card'

interface Size { id: string; label: string; width: string | null; height: string | null; unit: string; unitPrice: string; sideMode?: string; variantType?: string | null; sizeGroup?: string | null; assembledHeightDescription?:string|null; frontTemplateId?:string|null; backTemplateId?:string|null }
interface Product { id: string; name: string; description: string; basePrice: string; templateId: string | null; sizeMode: string; allowCustomDimensions: boolean; category?: { name: string }; template: { id: string; name: string; status: string } | null; images: Array<{ id: string; url: string; alt: string | null; isPrimary: boolean }>; sizes: Size[] }
interface ReviewData { reviews: Array<{ id:string; displayName:string; overall:number; productQuality:number; printQuality:number; colourFinishQuality:number; timeliness:number; service:number; feedback:string|null; verifiedPurchase:boolean; createdAt:string }>; summary:{overallRating:number;count:number;distribution:Record<string,number>} }

function StarRating({ rating, size = 'h-4 w-4' }: { rating: number; size?: string }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${size} ${
            star <= Math.round(rating)
              ? 'fill-amber-400 text-amber-400'
              : 'fill-zinc-200 text-zinc-200'
          }`}
        />
      ))}
    </div>
  )
}
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
  const [customSize,setCustomSize]=useState(false)
  const [customHeight,setCustomHeight]=useState('')
  const [customWidth,setCustomWidth]=useState('')
  const [imageIndex, setImageIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [artwork, setArtwork] = useState<ArtworkSelection | null>(null)
  const [reviews,setReviews]=useState<ReviewData|null>(null)
  useEffect(() => { void (async () => { try { const [response,reviewResponse] = await Promise.all([fetch(`/api/products/${id}`),fetch(`/api/reviews?productId=${id}`)]); const payload = await response.json(); if (!response.ok) throw new Error(payload.error?.message || 'Product not found.'); setProduct(payload.data.product); setSizeId(payload.data.product.sizes.some((size: Size) => size.id === requestedSizeId) ? requestedSizeId! : payload.data.product.sizes[0]?.id || ''); if(reviewResponse.ok)setReviews((await reviewResponse.json()).data) } catch (err) { setError(err instanceof Error ? err.message : 'The product could not be loaded.') } finally { setLoading(false) } })() }, [id, requestedSizeId])
  const selectedSize = useMemo(() => product?.sizes.find((size) => size.id === sizeId), [product, sizeId])
  function selectVariant(field:'variantType'|'sizeGroup'|'sideMode', value:string){if(!product)return;const target={variantType:selectedSize?.variantType,sizeGroup:selectedSize?.sizeGroup,sideMode:selectedSize?.sideMode,[field]:value};const exact=product.sizes.find((size)=>size.variantType===target.variantType&&size.sizeGroup===target.sizeGroup&&size.sideMode===target.sideMode);const fallback=product.sizes.find((size)=>size[field]===value);setSizeId((exact||fallback||product.sizes[0]).id)}
  function add() { if (!product || !selectedSize) return setError('Select an available size.'); if(customSize&&(!(Number(customHeight)>0)||!(Number(customWidth)>0)))return setError('Enter valid custom Height and Width.'); setAdding(true); const designId = customizationRef && /^[0-9a-f-]{36}$/i.test(customizationRef) ? customizationRef : null; const designSource = artwork ? 'customer_upload' : customizationRef ? 'online_editor' : 'design_assistance'; const templateId=selectedSize.frontTemplateId||product.template?.id||null; addItem({ productId: product.id, productName: product.name, sizeId: selectedSize.id, sizeLabel: customSize?`${customHeight} × ${customWidth} ${selectedSize.unit}`:selectedSize.label, templateId, templateName: product.template?.name || null, designId, customizationRef, artworkId: artwork?.id || null, designSource, quantity, price: unitPrice, image: (product.images.find((image) => image.isPrimary) || product.images[0])?.url, specifications: { ...(customizationRef ? { customizationRef } : {}), ...(customSize?{customHeight,customWidth}:{}), designSource, frontTemplateId:templateId||'', backTemplateId:selectedSize.backTemplateId||'', sideMode:selectedSize.sideMode||'single' } }); router.push('/cart') }
  if (loading) return <div className="grid min-h-[70vh] place-items-center">Loading product…</div>
  if (!product) return <div className="grid min-h-[70vh] place-items-center text-center"><div><h1 className="text-2xl font-bold">Product unavailable</h1><p className="mt-2 text-muted-foreground">{error}</p><Link href="/products"><Button className="mt-5"><ArrowLeft /> Back to products</Button></Link></div></div>
  const image = product.images[imageIndex] || product.images[0]
  const baseUnitPrice = Number(selectedSize?.unitPrice || product.basePrice)
  const customRatio = customSize && selectedSize?.height && selectedSize.width ? Number(customHeight)*Number(customWidth)/(Number(selectedSize.height)*Number(selectedSize.width)) : 1
  const unitPrice = customSize && Number.isFinite(customRatio) && customRatio>0 ? Math.round(baseUnitPrice*customRatio*100)/100 : baseUnitPrice
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
            {product.category?.name && <p className="mb-2 text-sm font-bold uppercase tracking-wider text-primary">{product.category.name}</p>}
            <h1 className="text-4xl font-black">{product.name}</h1>
            <p className="mt-3 text-3xl font-black text-primary">
              ${unitPrice.toFixed(2)}{' '}
              <span className="text-sm font-normal text-muted-foreground">per unit</span>
            </p>
          </div>

          <div className="space-y-5 border-y py-6">
            {/* Size Selection */}
            {product.sizeMode==='fixed_variants'?<div className="grid gap-4 sm:grid-cols-3">
              <label className="text-sm font-semibold">Flag style<select className="mt-2 h-11 w-full rounded-md border bg-background px-3" value={selectedSize?.variantType||''} onChange={(e)=>selectVariant('variantType',e.target.value)}>{[...new Set(product.sizes.map((size)=>size.variantType).filter(Boolean))].map((value)=><option key={value!} value={value!}>{value}</option>)}</select></label>
              <label className="text-sm font-semibold">Size<select className="mt-2 h-11 w-full rounded-md border bg-background px-3" value={selectedSize?.sizeGroup||''} onChange={(e)=>selectVariant('sizeGroup',e.target.value)}>{[...new Set(product.sizes.map((size)=>size.sizeGroup).filter(Boolean))].map((value)=><option key={value!} value={value!}>{value}</option>)}</select></label>
              <label className="text-sm font-semibold">Printing<select className="mt-2 h-11 w-full rounded-md border bg-background px-3" value={selectedSize?.sideMode||''} onChange={(e)=>selectVariant('sideMode',e.target.value)}>{[...new Set(product.sizes.map((size)=>size.sideMode).filter(Boolean))].map((value)=><option key={value!} value={value!}>{value}-sided</option>)}</select></label>
              <div className="rounded-lg bg-secondary p-3 text-sm sm:col-span-3"><b>{selectedSize?.label}</b> · {selectedSize?.height} × {selectedSize?.width} {selectedSize?.unit} · ${Number(selectedSize?.unitPrice||0).toFixed(2)}{selectedSize?.assembledHeightDescription&&<span className="mt-1 block text-muted-foreground">{selectedSize.assembledHeightDescription}</span>}</div>
            </div>:<div>
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
                  {size.label} {size.sideMode ? `· ${size.sideMode}-sided` : ''} - ${Number(size.unitPrice).toFixed(2)}
                  </option>
                ))}
              </select>
              {selectedSize?.width && selectedSize.height && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Height × Width: {selectedSize.height} × {selectedSize.width} {selectedSize.unit}{selectedSize.variantType ? ` · ${selectedSize.variantType} / ${selectedSize.sizeGroup}` : ''}
                </p>
              )}
            </div>}
            {product.allowCustomDimensions && !product.template && <div className="rounded-lg border p-3"><label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={customSize} onChange={(event)=>setCustomSize(event.target.checked)}/> Custom Size</label>{customSize&&<div className="mt-3 grid grid-cols-2 gap-3"><label className="text-sm">Height<Input type="number" min="0.001" step="0.001" value={customHeight} onChange={(event)=>setCustomHeight(event.target.value)}/></label><label className="text-sm">Width<Input type="number" min="0.001" step="0.001" value={customWidth} onChange={(event)=>setCustomWidth(event.target.value)}/></label><p className="col-span-2 text-xs text-muted-foreground">{selectedSize?.unit} · price scales by print area from the selected production preset.</p></div>}</div>}

            {/* Template Editor Link */}
            {(selectedSize?.frontTemplateId || product.template) && selectedSize && (
              <div className="rounded-lg bg-secondary p-4">
                <p className="font-semibold">Editable design included</p>
                <p className="text-sm text-muted-foreground">{selectedSize.frontTemplateId ? 'Variant-specific production template' : product.template?.name}</p>
                <Link
                  href={`/design?templateId=${selectedSize.frontTemplateId || product.template?.id}&productId=${product.id}&sizeId=${selectedSize.id}`}
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
            productName={product.name}
            sizeId={selectedSize?.id || ''}
            sizeLabel={selectedSize?.label || ''}
            variantLabel={[selectedSize?.variantType,selectedSize?.sizeGroup,selectedSize?.sideMode&&`${selectedSize.sideMode}-sided`].filter(Boolean).join(' · ')}
            quantity={quantity}
            value={artwork}
            onChange={setArtwork}
            initiallyOpen={searchParams.get('uploadArtwork')==='1'}
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
          <div className="grid gap-3 rounded-xl border bg-card p-5 sm:grid-cols-3"><div><p className="font-bold">Production-ready</p><p className="text-sm text-muted-foreground">Online designs are exported with configured bleed and trim marks.</p></div><div><p className="font-bold">Artwork protected</p><p className="text-sm text-muted-foreground">Uploaded print files remain unchanged.</p></div><div><p className="font-bold">Australia-wide</p><p className="text-sm text-muted-foreground">Production and delivery support across Australia.</p></div></div>
        </section>
      </div>
      <section className="mt-12 border-t pt-10">
  <div className="flex flex-wrap items-end justify-between gap-3">
    <div>
      <p className="text-sm font-bold uppercase tracking-wider text-primary">Customer feedback</p>
      <h2 className="text-3xl font-black">Reviews for {product.name}</h2>
    </div>

    {/* Overall Star Summary */}
    {reviews?.summary.count ? (
      <div className="flex items-center gap-2">
        <StarRating rating={reviews.summary.overallRating} size="h-5 w-5" />
        <span className="text-lg font-bold">
          {reviews.summary.overallRating.toFixed(1)} / 5
        </span>
        <span className="text-sm text-muted-foreground">
          ({reviews.summary.count} review{reviews.summary.count === 1 ? '' : 's'})
        </span>
      </div>
    ) : (
      <p className="text-lg font-bold text-muted-foreground">No published reviews yet</p>
    )}
  </div>

  {reviews?.summary.count ? (
    <>
      {/* Distribution Bars */}
      <div className="mt-6 max-w-md space-y-2">
        {[5, 4, 3, 2, 1].map((rating) => {
          const count = reviews.summary.distribution[String(rating)] || 0
          const percentage = (count / reviews.summary.count) * 100
          return (
            <div key={rating} className="flex items-center gap-2 text-sm">
              <span className="w-8 font-medium">{rating} star</span>
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-amber-400"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <span className="w-8 text-right text-xs text-muted-foreground">{count}</span>
            </div>
          )
        })}
      </div>

      {/* Review Cards */}
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {reviews.reviews.map((review) => (
          <article key={review.id} className="rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold">
                {review.displayName}
                {review.verifiedPurchase && (
                  <span className="ml-2 rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">
                    Verified purchase
                  </span>
                )}
              </p>
              <time className="text-xs text-muted-foreground">
                {new Date(review.createdAt).toLocaleDateString()}
              </time>
            </div>

            {/* Individual Review Rating */}
            <div className="mt-2 flex items-center gap-2">
              <StarRating rating={review.overall} size="h-4 w-4" />
            </div>

            {review.feedback && (
              <p className="mt-3 text-sm leading-6 text-foreground">{review.feedback}</p>
            )}

            <div className="mt-4 grid grid-cols-2 gap-1 text-xs text-muted-foreground border-t pt-3">
              <span>Product quality: {review.productQuality}/5</span>
              <span>Print quality: {review.printQuality}/5</span>
              <span>Colour & finish: {review.colourFinishQuality}/5</span>
              <span>Timeliness: {review.timeliness}/5</span>
              <span>Service: {review.service}/5</span>
            </div>
          </article>
        ))}
      </div>
    </>
  ) : (
    <p className="mt-5 rounded-xl border border-dashed p-8 text-center text-muted-foreground">
      Published reviews from verified purchases will appear here.
    </p>
  )}
</section>
    </div>
  </main>
);
}

export default function ProductDetailPage(props: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<div className="grid min-h-[70vh] place-items-center">Loading product…</div>}><ProductDetailContent {...props} /></Suspense>
}
