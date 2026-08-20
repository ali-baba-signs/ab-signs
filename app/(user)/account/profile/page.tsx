'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Package, Pencil, Plus, Save, Star, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const blankAddress = { label: 'Home', fullName: '', phone: '', alternatePhone: '', addressLine1: '', addressLine2: '', city: '', region: '', postalCode: '', country: 'Australia', deliveryInstructions: '', defaultShipping: true, defaultBilling: true }
type Address = typeof blankAddress & { id: string }

export default function ProfilePage() {
  const [profile, setProfile] = useState({ name: '', email: '', company: '', phone: '', alternatePhone: '', deliveryInstructions: '' })
  const [addresses, setAddresses] = useState<Address[]>([])
  const [address, setAddress] = useState(blankAddress)
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [reviews, setReviews] = useState<Array<{id:string;orderItemId:string;productId:string;productName:string;overall:number;feedback:string|null;moderationStatus:string;createdAt:string}>>([])
  const [orders, setOrders] = useState<Array<{id:string;orderNumber:string;status:string;paymentStatus:string;deliveryType:string;currency:string;totalAmount:string;createdAt:string;items:Array<{id:string;productId:string;quantity:number;product?:{name:string};specifications:Record<string,string>|null}>}>>([])

  async function load() {
    const [profilePayload, addressPayload, reviewPayload, orderPayload] = await Promise.all([fetch('/api/account/profile').then((response) => response.json()), fetch('/api/account/addresses').then((response) => response.json()), fetch('/api/reviews?mine=true').then((response) => response.json()), fetch('/api/orders').then((response) => response.json())])
    if (profilePayload.error) throw new Error(profilePayload.error.message)
    setProfile({ name: profilePayload.data.profile.name || '', email: profilePayload.data.profile.email || '', company: profilePayload.data.profile.company || '', phone: profilePayload.data.profile.phone || '', alternatePhone: profilePayload.data.profile.alternatePhone || '', deliveryInstructions: profilePayload.data.profile.deliveryInstructions || '' })
    setAddresses(addressPayload.data?.addresses || [])
    setReviews(reviewPayload.data?.reviews || [])
    setOrders(orderPayload.data?.orders || [])
  }

  useEffect(() => { const timer = window.setTimeout(() => void load().catch((error) => setMessage(error.message)), 0); return () => window.clearTimeout(timer) }, [])

  async function saveProfile() {
    const response = await fetch('/api/account/profile', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(profile) })
    const payload = await response.json()
    setMessage(response.ok ? 'Profile saved.' : payload.error?.message || 'Profile save failed.')
  }
  async function saveAddress() {
    const response = await fetch(editingAddressId ? `/api/account/addresses/${editingAddressId}` : '/api/account/addresses', { method: editingAddressId ? 'PUT' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(address) })
    const payload = await response.json()
    if (!response.ok) return setMessage(payload.error?.message || 'Address save failed.')
    setAddress(blankAddress); setEditingAddressId(null); setMessage('Address saved.'); await load()
  }
  async function remove(id: string) { await fetch(`/api/account/addresses/${id}`, { method: 'DELETE' }); await load() }
  const input = (label: string, key: keyof typeof blankAddress, required = false) => <label className="text-sm font-semibold">{label}<Input required={required} className="mt-1" value={String(address[key])} onChange={(event) => setAddress({ ...address, [key]: event.target.value })} /></label>

  return <main className="min-h-screen bg-background px-4 py-8"><div className="mx-auto max-w-5xl">
    <Link href="/" className="inline-flex gap-2"><ArrowLeft /> Home</Link><h1 className="mt-3 text-3xl font-black">My profile</h1>
    <div className="mt-5 grid gap-3 sm:grid-cols-2"><Link href="/account/orders" className="flex items-center gap-3 rounded-xl border bg-card p-4 font-bold hover:border-primary"><Package className="text-primary"/> Previous orders, current orders and tracking</Link><Link href="/account/offers" className="flex items-center gap-3 rounded-xl border bg-card p-4 font-bold hover:border-primary"><Star className="text-primary"/> Available offers and voucher history</Link></div>
    {message && <p className="mt-4 rounded bg-secondary p-3">{message}</p>}
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <section className="rounded-xl border bg-card p-5"><h2 className="font-bold">Contact profile</h2><div className="mt-4 space-y-3">
        {(['name', 'company', 'phone', 'alternatePhone'] as const).map((key) => <label key={key} className="block text-sm font-semibold">{key === 'company' ? 'Company / business name' : key.replace(/([A-Z])/g, ' $1')}<Input className="mt-1" value={profile[key]} onChange={(event) => setProfile({ ...profile, [key]: event.target.value })} /></label>)}
        <label className="block text-sm font-semibold">Email<Input type="email" className="mt-1" value={profile.email} readOnly aria-readonly="true"/><span className="mt-1 block text-xs font-normal text-muted-foreground">Email is owned by your secure sign-in account and cannot be changed from the contact profile.</span></label>
        <label className="block text-sm font-semibold">Delivery instructions<textarea className="mt-1 min-h-20 w-full rounded border p-2" value={profile.deliveryInstructions} onChange={(event) => setProfile({ ...profile, deliveryInstructions: event.target.value })} /></label>
        <Button onClick={() => void saveProfile()}><Save /> Save profile</Button>
      </div></section>
      <section className="rounded-xl border bg-card p-5"><h2 className="font-bold">{editingAddressId ? 'Edit saved address' : 'Add saved address'}</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">
        {input('Label', 'label')}{input('Full name', 'fullName', true)}{input('Phone', 'phone')}{input('Alternate phone', 'alternatePhone')}{input('Address line 1', 'addressLine1', true)}{input('Address line 2', 'addressLine2')}{input('City', 'city', true)}{input('State / region', 'region')}{input('Postal code', 'postalCode', true)}{input('Country', 'country', true)}
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={address.defaultShipping} onChange={(event) => setAddress({ ...address, defaultShipping: event.target.checked })} /> Default shipping</label>
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={address.defaultBilling} onChange={(event) => setAddress({ ...address, defaultBilling: event.target.checked })} /> Default billing</label>
        <label className="text-sm font-semibold sm:col-span-2">Delivery instructions<textarea className="mt-1 min-h-20 w-full rounded border p-2" value={address.deliveryInstructions} onChange={(event) => setAddress({ ...address, deliveryInstructions: event.target.value })} /></label>
        <div className="flex gap-2 sm:col-span-2"><Button className="flex-1" onClick={() => void saveAddress()}>{editingAddressId ? <Save /> : <Plus />} Save address</Button>{editingAddressId && <Button variant="outline" onClick={() => { setEditingAddressId(null); setAddress(blankAddress) }}><X /> Cancel</Button>}</div>
      </div></section>
    </div>
    <section className="mt-6 rounded-xl border bg-card p-5"><h2 className="font-bold">Saved addresses</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{addresses.map((item) => <article key={item.id} className="rounded border p-3"><p className="font-semibold">{item.label} {item.defaultShipping && '· Shipping'} {item.defaultBilling && '· Billing'}</p><p className="text-sm">{item.fullName}, {item.addressLine1}, {item.city}, {item.postalCode}, {item.country}</p><div className="mt-2 flex gap-2"><Button size="sm" variant="outline" onClick={() => { setEditingAddressId(item.id); setAddress({ label: item.label, fullName: item.fullName, phone: item.phone, alternatePhone: item.alternatePhone, addressLine1: item.addressLine1, addressLine2: item.addressLine2, city: item.city, region: item.region, postalCode: item.postalCode, country: item.country, deliveryInstructions: item.deliveryInstructions, defaultShipping: item.defaultShipping, defaultBilling: item.defaultBilling }); window.scrollTo({ top: 0, behavior: 'smooth' }) }}><Pencil /> Edit</Button><Button size="sm" variant="outline" className="text-red-600" onClick={() => void remove(item.id)}><Trash2 /> Remove</Button></div></article>)}</div></section>
    <section className="mt-6 rounded-xl border bg-card p-5"><h2 className="font-bold">Orders and receipts</h2><p className="mt-1 text-sm text-muted-foreground">Current orders appear first; delivered, completed, and cancelled orders remain in your history.</p><div className="mt-4 space-y-3">{orders.map((order)=><article key={order.id} className="rounded border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><Link href={`/account/orders/${order.id}`} className="font-bold text-primary">{order.orderNumber}</Link><p className="text-sm">{new Date(order.createdAt).toLocaleDateString()} · {order.status.replaceAll('_',' ')} · {order.paymentStatus.replaceAll('_',' ')} · {order.deliveryType}</p></div><p className="font-black">{order.currency} ${Number(order.totalAmount).toFixed(2)}</p></div><div className="mt-3 flex flex-wrap gap-2"><Link href={`/account/orders/${order.id}`}><Button size="sm" variant="outline">Track / view details</Button></Link>{order.paymentStatus==='paid'&&<a href={`/api/orders/${order.id}/receipt`}><Button size="sm" variant="outline"><Package/> Download receipt</Button></a>}{['delivered','completed'].includes(order.status)&&order.items.filter((item)=>!reviews.some((review)=>review.orderItemId===item.id)).map((item)=><Link key={item.id} href={`/account/orders/${order.id}/review?itemId=${item.id}`}><Button size="sm">Write a Review · {item.product?.name||item.specifications?.productName||'Product'}</Button></Link>)}</div></article>)}</div>{!orders.length&&<p className="mt-3 text-sm text-muted-foreground">You have no orders yet.</p>}</section>
    <section id="my-reviews" className="mt-6 rounded-xl border bg-card p-5"><h2 className="font-bold">My reviews</h2>{reviews.length?<div className="mt-4 grid gap-3 md:grid-cols-2">{reviews.map((review)=><article key={review.id} className="rounded border p-3"><Link href={`/products/${review.productId}`} className="font-bold text-primary">{review.productName}</Link><p className="font-semibold">{review.overall}/5 · {review.moderationStatus}</p>{review.feedback&&<p className="mt-2 text-sm">{review.feedback}</p>}<time className="mt-2 block text-xs text-muted-foreground">{new Date(review.createdAt).toLocaleDateString()}</time></article>)}</div>:<p className="mt-3 text-sm text-muted-foreground">You have not submitted a product review yet. Review forms appear automatically after delivery.</p>}</section>
  </div></main>
}
