'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ProductCard } from '@/components/products/product-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Product { id: string; name: string; description: string | null; basePrice: string; featured: boolean; category: { slug: string; name: string } | null; images: Array<{ url: string; isPrimary: boolean }>; socialProof?: { averageRating: number; reviewCount: number; soldQuantity: number } }
function plain(html: string | null) { if (!html) return ''; if (typeof document === 'undefined') return html.replace(/<[^>]+>/g, ' '); const element = document.createElement('div'); element.innerHTML = html; return element.textContent || '' }

function ProductsContent() {
  const searchParams = useSearchParams()
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [category, setCategory] = useState(searchParams.get('category') || 'all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => { void (async () => { try { const response = await fetch('/api/products?limit=100'); const payload = await response.json(); if (!response.ok) throw new Error(payload.error?.message || 'Products could not be loaded.'); setProducts(payload.data.products) } catch (err) { setError(err instanceof Error ? err.message : 'Products could not be loaded.') } finally { setLoading(false) } })() }, [])
  const categories = useMemo(() => Array.from(new Map(products.flatMap((product) => product.category ? [[product.category.slug, product.category.name] as const] : [])).entries()), [products])
  const filtered = useMemo(() => products.filter((product) => (category === 'all' || product.category?.slug === category) && (!search || `${product.name} ${plain(product.description)}`.toLowerCase().includes(search.toLowerCase()))), [category, products, search])
  return <div className="min-h-screen bg-background"><section className="border-b py-10"><div className="mx-auto max-w-7xl px-4"><h1 className="text-4xl font-black">Our products</h1><p className="mt-2 text-muted-foreground">Choose a product, size, price, and editable design template.</p></div></section><div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-[240px_1fr]"><aside><label className="text-sm font-semibold">Search<Input className="mt-2" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products…" /></label><div className="mt-6"><p className="text-sm font-semibold">Category</p><div className="mt-2 space-y-2"><button onClick={() => setCategory('all')} className={`w-full rounded px-3 py-2 text-left text-sm ${category === 'all' ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>All products</button>{categories.map(([slug, name]) => <button key={slug} onClick={() => setCategory(slug)} className={`w-full rounded px-3 py-2 text-left text-sm ${category === slug ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>{name}</button>)}</div></div>{(search || category !== 'all') && <Button variant="outline" className="mt-5 w-full" onClick={() => { setSearch(''); setCategory('all') }}>Clear filters</Button>}</aside><main>{error && <p role="alert" className="rounded-md bg-red-50 p-4 text-red-700">{error}</p>}{loading ? <p className="py-20 text-center">Loading products…</p> : filtered.length === 0 ? <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">No products match those filters.</div> : <><p className="mb-5 text-sm text-muted-foreground">Showing {filtered.length} product{filtered.length === 1 ? '' : 's'}</p><div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{filtered.map((product) => { const image = product.images.find((item) => item.isPrimary) || product.images[0]; return <ProductCard key={product.id} id={product.id} name={product.name} description={plain(product.description)} basePrice={product.basePrice} featured={product.featured} image={image?.url} averageRating={product.socialProof?.averageRating} reviewCount={product.socialProof?.reviewCount} soldQuantity={product.socialProof?.soldQuantity} /> })}</div></>}</main></div></div>
}

export default function ProductsPage() {
  return <Suspense fallback={<div className="grid min-h-[60vh] place-items-center">Loading products…</div>}><ProductsContent /></Suspense>
}
