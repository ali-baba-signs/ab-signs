'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowDown, ArrowLeft, ArrowUp, Edit2, Plus, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAdminSession } from '@/lib/admin-auth-client'
import { adminPath } from '@/lib/auth/admin-path'
import { getUserRole } from '@/lib/auth/roles'
import { uploadAdminFile } from '@/lib/storage/upload-client'
import { ImageCropUpload } from '@/components/admin/image-crop-upload'

interface Hero {
  id: string; desktopAssetId: string; mobileAssetId: string | null; title: string | null; description: string | null; eyebrow: string | null; buttonLabel: string | null; buttonUrl: string | null; altText: string; horizontalAlignment: 'left' | 'center' | 'right'; verticalAlignment: 'top' | 'middle' | 'bottom'; featured: boolean; enabled: boolean; displayOrder: number; desktopAsset: { url: string } | null; mobileAsset: { url: string } | null
}

interface HeroForm { desktopAssetId: string; mobileAssetId: string; title: string; description: string; eyebrow: string; buttonLabel: string; buttonUrl: string; altText: string; horizontalAlignment: 'left' | 'center' | 'right'; verticalAlignment: 'top' | 'middle' | 'bottom'; featured: boolean; enabled: boolean; displayOrder: number }
const blank: HeroForm = { desktopAssetId: '', mobileAssetId: '', title: '', description: '', eyebrow: '', buttonLabel: '', buttonUrl: '', altText: '', horizontalAlignment: 'left', verticalAlignment: 'middle', featured: true, enabled: true, displayOrder: 0 }

function toForm(hero: Hero): HeroForm {
  return { desktopAssetId: hero.desktopAssetId, mobileAssetId: hero.mobileAssetId || '', title: hero.title || '', description: hero.description || '', eyebrow: hero.eyebrow || '', buttonLabel: hero.buttonLabel || '', buttonUrl: hero.buttonUrl || '', altText: hero.altText, horizontalAlignment: hero.horizontalAlignment, verticalAlignment: hero.verticalAlignment, featured: hero.featured, enabled: hero.enabled, displayOrder: hero.displayOrder }
}

export default function HomepageAdminPage() {
  const { data: session, isPending } = useAdminSession()
  const [heroes, setHeroes] = useState<Hero[]>([])
  const [desktopPreview, setDesktopPreview] = useState('')
  const [mobilePreview, setMobilePreview] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<HeroForm>(blank)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/heroes', { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error?.message || 'Hero slides could not be loaded.')
      setHeroes(payload.data.heroes)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Homepage settings could not be loaded.') }
  }, [])

  useEffect(() => {
    if (getUserRole(session?.user) !== 'admin') return
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load, session?.user])

  async function upload(kind: 'desktop' | 'mobile', file?: File) {
    if (!file) return
    try {
      const asset = await uploadAdminFile(file, 'homepage', `homepage/hero/${kind}`)
      setForm((current) => ({ ...current, [kind === 'desktop' ? 'desktopAssetId' : 'mobileAssetId']: asset.id }))
      if (kind === 'desktop') setDesktopPreview(asset.url); else setMobilePreview(asset.url)
      setMessage(`${kind} hero image uploaded and selected.`)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Hero image upload failed.') }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setMessage('')
    try {
      const response = await fetch(editingId ? `/api/admin/heroes/${editingId}` : '/api/admin/heroes', { method: editingId ? 'PUT' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error?.message || 'Hero slide could not be saved.')
      setMessage(editingId ? 'Hero slide updated.' : 'Hero slide created.')
      setEditingId(null); setForm(blank); setDesktopPreview(''); setMobilePreview(''); await load()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Hero slide could not be saved.') }
    finally { setSaving(false) }
  }

  async function update(hero: Hero, changes: Partial<HeroForm>) {
    const response = await fetch(`/api/admin/heroes/${hero.id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...toForm(hero), ...changes }) })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error?.message || 'Hero slide could not be updated.')
  }

  async function move(index: number, direction: -1 | 1) {
    const target = heroes[index + direction]
    if (!target) return
    try {
      await update(heroes[index], { displayOrder: target.displayOrder })
      await update(target, { displayOrder: heroes[index].displayOrder })
      await load()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Hero order could not be changed.') }
  }

  async function remove(hero: Hero) {
    if (!window.confirm(`Delete hero “${hero.title || hero.altText}”? The image asset will remain available.`)) return
    const response = await fetch(`/api/admin/heroes/${hero.id}`, { method: 'DELETE' })
    const payload = await response.json()
    if (!response.ok) return setMessage(payload.error?.message || 'Hero could not be deleted.')
    setMessage('Hero slide deleted.'); await load()
  }

  if (isPending) return <div className="grid min-h-screen place-items-center">Loading…</div>
  if (!session?.user || getUserRole(session.user) !== 'admin') return <div className="grid min-h-screen place-items-center"><Link href={adminPath('/login')}>Admin sign in required</Link></div>
  return <main className="min-h-screen bg-zinc-50 px-4 py-8"><div className="mx-auto max-w-7xl"><Link href={adminPath()} className="inline-flex items-center gap-2 text-sm font-semibold"><ArrowLeft className="h-4 w-4" /> Dashboard</Link><div className="mt-2 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-3xl font-black">Homepage content</h1><p className="mt-2 text-sm text-zinc-500">Manage the hero carousel and reusable promotional sections.</p></div><Link href={adminPath('/homepage/promotions')}><Button variant="outline">Manage promotional sections</Button></Link></div>
    {message && <p role="status" className="mt-5 rounded-md bg-white p-3 text-sm shadow-sm">{message}</p>}
    <div className="mt-6 grid gap-6 xl:grid-cols-[420px_1fr]"><form onSubmit={save} className="h-fit rounded-xl border bg-white p-5"><h2 className="text-xl font-bold">{editingId ? 'Edit hero slide' : 'Create hero slide'}</h2><div className="mt-4 space-y-4">
      <ImageCropUpload label="Desktop hero image" recommendedWidth={1920} recommendedHeight={1080} value={desktopPreview || heroes.find((hero) => hero.id === editingId)?.desktopAsset?.url || undefined} onCropped={(file) => upload('desktop', file)} />
      <ImageCropUpload label="Mobile hero image" recommendedWidth={1080} recommendedHeight={1350} optional value={mobilePreview || heroes.find((hero) => hero.id === editingId)?.mobileAsset?.url || undefined} onCropped={(file) => upload('mobile', file)} />
      <label className="block text-sm font-semibold">Image alt text<Input required className="mt-2" value={form.altText} onChange={(event) => setForm({ ...form, altText: event.target.value })} /></label><label className="block text-sm font-semibold">Optional eyebrow<Input className="mt-2" value={form.eyebrow} onChange={(event) => setForm({ ...form, eyebrow: event.target.value })} /></label><label className="block text-sm font-semibold">Optional title<Input className="mt-2" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><label className="block text-sm font-semibold">Optional supporting text<textarea className="mt-2 min-h-20 w-full rounded border p-2" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
      <div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold">Button label<Input className="mt-2" value={form.buttonLabel} onChange={(event) => setForm({ ...form, buttonLabel: event.target.value })} /></label><label className="text-sm font-semibold">Button URL<Input className="mt-2" placeholder="/products" value={form.buttonUrl} onChange={(event) => setForm({ ...form, buttonUrl: event.target.value })} /></label><label className="text-sm font-semibold">Horizontal<select className="mt-2 h-10 w-full rounded border px-2" value={form.horizontalAlignment} onChange={(event) => setForm({ ...form, horizontalAlignment: event.target.value as HeroForm['horizontalAlignment'] })}>{['left','center','right'].map((value) => <option key={value}>{value}</option>)}</select></label><label className="text-sm font-semibold">Vertical<select className="mt-2 h-10 w-full rounded border px-2" value={form.verticalAlignment} onChange={(event) => setForm({ ...form, verticalAlignment: event.target.value as HeroForm['verticalAlignment'] })}>{['top','middle','bottom'].map((value) => <option key={value}>{value}</option>)}</select></label><label className="text-sm font-semibold">Order<Input className="mt-2" type="number" min="0" max="10000" value={form.displayOrder} onChange={(event) => setForm({ ...form, displayOrder: Number(event.target.value) })} /></label></div>
      <div className="flex gap-5"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.featured} onChange={(event) => setForm({ ...form, featured: event.target.checked })} /> Featured</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} /> Enabled</label></div><div className="flex gap-2"><Button type="submit" disabled={saving}><Save /> {saving ? 'Saving…' : 'Save hero'}</Button>{editingId && <Button type="button" variant="outline" onClick={() => { setEditingId(null); setForm(blank); setDesktopPreview(''); setMobilePreview('') }}>Cancel</Button>}</div>
    </div></form><section className="overflow-hidden rounded-xl border bg-white"><div className="border-b p-4 font-bold">Hero slides</div>{heroes.length === 0 ? <p className="p-8 text-center text-sm text-zinc-500">No managed heroes yet. The built-in fallback slides remain visible until one is created.</p> : <ul className="divide-y">{heroes.map((hero, index) => <li key={hero.id} className="grid gap-4 p-4 md:grid-cols-[160px_1fr_auto]"><div className="h-24 overflow-hidden rounded bg-zinc-100">{hero.desktopAsset?.url && <img src={hero.desktopAsset.url} alt="" className="h-full w-full object-cover" />}</div><div><p className="font-bold">{hero.title || <span className="italic text-zinc-500">Image-only hero</span>}</p><p className="text-xs text-zinc-500">{hero.altText} · {hero.horizontalAlignment}/{hero.verticalAlignment} · order {hero.displayOrder}</p><div className="mt-3 flex gap-4"><label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={hero.featured} onChange={(event) => void update(hero, { featured: event.target.checked }).then(load).catch((error) => setMessage(error.message))} /> Featured</label><label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={hero.enabled} onChange={(event) => void update(hero, { enabled: event.target.checked }).then(load).catch((error) => setMessage(error.message))} /> Enabled</label></div></div><div className="flex gap-1"><button title="Move earlier" disabled={index === 0} onClick={() => void move(index, -1)} className="h-9 rounded border p-2 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button><button title="Move later" disabled={index === heroes.length - 1} onClick={() => void move(index, 1)} className="h-9 rounded border p-2 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button><button title="Edit" onClick={() => { setEditingId(hero.id); setForm(toForm(hero)); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="h-9 rounded border p-2"><Edit2 className="h-4 w-4" /></button><button title="Delete" onClick={() => void remove(hero)} className="h-9 rounded border p-2 text-red-600"><Trash2 className="h-4 w-4" /></button></div></li>)}</ul>}</section></div>
  </div></main>
}
