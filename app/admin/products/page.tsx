'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Edit2, Plus, Trash2 } from 'lucide-react'
import { useAdminSession } from '@/lib/admin-auth-client'
import { adminPath } from '@/lib/auth/admin-path'
import { getUserRole } from '@/lib/auth/roles'
import { Button } from '@/components/ui/button'
import { CategoryManager } from '@/components/admin/category-manager'

interface Product { id: string; name: string; sku: string; basePrice: string; active: boolean; createdAt: string; images: Array<{ url: string; isPrimary: boolean }>; sizes: unknown[] }

export default function ProductManagementPage() {
  const { data: session, isPending } = useAdminSession()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState('')
  const [message, setMessage] = useState('')
  const load = useCallback(async () => {
    setLoading(true); setMessage('')
    try { const response = await fetch('/api/admin/products', { cache: 'no-store' }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error?.message || 'Products could not be loaded.'); setProducts(payload.data.products) }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Products could not be loaded.') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { const timer = window.setTimeout(() => { if (getUserRole(session?.user) === 'admin') void load() }, 0); return () => window.clearTimeout(timer) }, [load, session?.user])

  async function remove(product: Product) {
    if (!window.confirm(`Delete “${product.name}”? Product images will also be removed from storage where possible.`)) return
    setDeleting(product.id); setMessage('')
    try { const response = await fetch(`/api/admin/products/${product.id}`, { method: 'DELETE' }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error?.message || 'The product could not be deleted.'); setMessage('Product deleted successfully.'); await load() }
    catch (error) { setMessage(error instanceof Error ? error.message : 'The product could not be deleted.') }
    finally { setDeleting('') }
  }

  if (isPending) return <div className="grid min-h-screen place-items-center">Loading…</div>
  if (!session?.user || getUserRole(session.user) !== 'admin') return <div className="grid min-h-screen place-items-center"><Link href={adminPath('/login')}>Admin sign in required</Link></div>
  return <main className="min-h-screen bg-background px-4 py-8"><div className="mx-auto max-w-7xl">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><Link href={adminPath()} className="inline-flex items-center gap-2 text-sm font-semibold"><ArrowLeft className="h-4 w-4" /> Dashboard</Link><h1 className="mt-2 text-3xl font-black">Products</h1></div><Link href={adminPath('/products/new')}><Button><Plus /> Add product</Button></Link></div>
    {message && <p role="status" className="mt-5 rounded-md bg-secondary p-3 text-sm">{message}</p>}
    <div className="mt-6 space-y-6"><CategoryManager /><section className="overflow-hidden rounded-xl border bg-card">
      {loading ? <p className="p-10 text-center">Loading products…</p> : products.length === 0 ? <div className="p-12 text-center"><p className="text-muted-foreground">No persisted products yet.</p><Link href={adminPath('/products/new')}><Button className="mt-4"><Plus /> Create the first product</Button></Link></div> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-secondary"><tr><th className="px-4 py-3 text-left">Product</th><th className="px-4 py-3 text-left">SKU</th><th className="px-4 py-3 text-left">From</th><th className="px-4 py-3 text-left">Status</th><th className="px-4 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y">{products.map((product) => <tr key={product.id}><td className="px-4 py-3"><div className="flex items-center gap-3">{product.images[0] ? <img src={(product.images.find((image) => image.isPrimary) || product.images[0]).url} alt="" className="h-12 w-12 rounded object-cover" /> : <div className="h-12 w-12 rounded bg-secondary" />}<div><p className="font-semibold">{product.name}</p><p className="text-xs text-muted-foreground">{product.sizes.length} size option(s)</p></div></div></td><td className="px-4 py-3">{product.sku}</td><td className="px-4 py-3">${Number(product.basePrice).toFixed(2)}</td><td className="px-4 py-3">{product.active ? 'Active' : 'Inactive'}</td><td className="px-4 py-3"><div className="flex justify-end gap-2"><Link href={adminPath(`/products/${product.id}`)}><Button size="sm" variant="outline"><Edit2 /> Edit</Button></Link><Button size="sm" variant="outline" disabled={deleting === product.id} onClick={() => void remove(product)} className="text-red-600"><Trash2 /> {deleting === product.id ? 'Deleting…' : 'Delete'}</Button></div></td></tr>)}</tbody></table></div>}
    </section></div>
  </div></main>
}
