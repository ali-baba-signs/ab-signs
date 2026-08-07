'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const blankAddress = { label: 'Home', fullName: '', phone: '', alternatePhone: '', addressLine1: '', addressLine2: '', city: '', region: '', postalCode: '', country: 'Australia', deliveryInstructions: '', defaultShipping: true, defaultBilling: true }
type Address = typeof blankAddress & { id: string }

export default function ProfilePage() {
  const [profile, setProfile] = useState({ name: '', email: '', phone: '', alternatePhone: '', deliveryInstructions: '' })
  const [addresses, setAddresses] = useState<Address[]>([])
  const [address, setAddress] = useState(blankAddress)
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  async function load() {
    const [profilePayload, addressPayload] = await Promise.all([fetch('/api/account/profile').then((response) => response.json()), fetch('/api/account/addresses').then((response) => response.json())])
    if (profilePayload.error) throw new Error(profilePayload.error.message)
    setProfile({ name: profilePayload.data.profile.name || '', email: profilePayload.data.profile.email || '', phone: profilePayload.data.profile.phone || '', alternatePhone: profilePayload.data.profile.alternatePhone || '', deliveryInstructions: profilePayload.data.profile.deliveryInstructions || '' })
    setAddresses(addressPayload.data?.addresses || [])
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
    <Link href="/" className="inline-flex gap-2"><ArrowLeft /> Home</Link><h1 className="mt-3 text-3xl font-black">Contact and addresses</h1>
    {message && <p className="mt-4 rounded bg-secondary p-3">{message}</p>}
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <section className="rounded-xl border bg-card p-5"><h2 className="font-bold">Contact profile</h2><div className="mt-4 space-y-3">
        {(['name', 'email', 'phone', 'alternatePhone'] as const).map((key) => <label key={key} className="block text-sm font-semibold">{key.replace(/([A-Z])/g, ' $1')}<Input type={key === 'email' ? 'email' : 'text'} className="mt-1" value={profile[key]} onChange={(event) => setProfile({ ...profile, [key]: event.target.value })} /></label>)}
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
  </div></main>
}
