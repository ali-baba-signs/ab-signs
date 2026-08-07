'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Edit2, FileCode2, ImageIcon, Plus, RefreshCw, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAdminSession } from '@/lib/admin-auth-client'
import { adminPath } from '@/lib/auth/admin-path'
import { getUserRole } from '@/lib/auth/roles'
import { uploadAdminFile, type UploadedAsset } from '@/lib/storage/upload-client'
import { generateFabricJsonFromSvg } from '@/lib/templates/fabric-svg-client'
import { sanitizeSvgMarkup } from '@/lib/templates/svg-sanitization'
import type { MeasurementUnit } from '@/lib/templates/size-conversion'

type AssetField = 'previewImage' | 'svg'
type FitMode = 'contain' | 'cover' | 'stretch'
interface AssetValue { id: string; key: string; url: string; filename?: string; checksum?: string }
interface SizeRow { id?: string; label: string; width: string; height: string; unit: MeasurementUnit; fitMode: FitMode; safeMargin: string; enabled: boolean; isDefault: boolean }
interface TemplateRow {
  id: string; name: string; description: string | null; category: string | null; status: string
  previewImageUrl: string | null; previewImageKey: string | null; previewAssetId: string | null
  svgUrl: string | null; svgKey: string | null; svgAssetId: string | null; svgChecksum: string | null
  physicalWidth: string | null; physicalHeight: string | null; measurementUnit: MeasurementUnit | null
  templateVersion: number; conversionVersion: number; conversionStatus: string; conversionError: string | null; generatedAt: string | null
  sizes: Array<{ id: string; label: string; width: string; height: string; unit: MeasurementUnit; fitMode: FitMode; safeMargin: string; enabled: boolean; isDefault: boolean }>
}

const definitions = [
  { field: 'previewImage' as const, label: 'Preview image', accept: 'image/png,image/jpeg,image/webp', icon: ImageIcon },
  { field: 'svg' as const, label: 'Editable SVG source', accept: 'image/svg+xml,.svg', icon: FileCode2 },
]
const blank = { name: '', description: '', category: 'templates', status: 'draft', width: '1828.8', height: '914.4', unit: 'mm' as MeasurementUnit }
const blankSize = (): SizeRow => ({ label: '6 x 3 ft', width: '6', height: '3', unit: 'ft', fitMode: 'contain', safeMargin: '0.1', enabled: true, isDefault: true })

function assetsOf(row: TemplateRow): Partial<Record<AssetField, AssetValue | null>> {
  return {
    previewImage: row.previewImageKey && row.previewAssetId ? { id: row.previewAssetId, key: row.previewImageKey, url: row.previewImageUrl || '' } : null,
    svg: row.svgKey && row.svgAssetId ? { id: row.svgAssetId, key: row.svgKey, url: row.svgUrl || '', checksum: row.svgChecksum || undefined } : null,
  }
}

export default function TemplatesPage() {
  const { data: session, isPending } = useAdminSession()
  const [rows, setRows] = useState<TemplateRow[]>([])
  const [editing, setEditing] = useState<TemplateRow | null>(null)
  const [form, setForm] = useState(blank)
  const [sizes, setSizes] = useState<SizeRow[]>([blankSize()])
  const [assets, setAssets] = useState<Partial<Record<AssetField, AssetValue | null>>>({})
  const [svgSource, setSvgSource] = useState<string | null>(null)
  const [regenerate, setRegenerate] = useState(false)
  const [progress, setProgress] = useState<Partial<Record<AssetField, number>>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/templates', { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error?.message || 'Templates could not be loaded.')
      setRows(payload.data.templates)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Templates could not be loaded.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (getUserRole(session?.user) !== 'admin') return
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load, session?.user])

  function start(row?: TemplateRow) {
    setEditing(row || null)
    setForm(row ? { name: row.name, description: row.description || '', category: row.category || 'templates', status: row.status, width: row.physicalWidth || '', height: row.physicalHeight || '', unit: row.measurementUnit || 'mm' } : blank)
    setAssets(row ? assetsOf(row) : {})
    setSizes(row?.sizes?.length ? row.sizes.map((size) => ({ ...size, width: String(size.width), height: String(size.height), safeMargin: String(size.safeMargin) })) : [blankSize()])
    setSvgSource(null); setRegenerate(false); setProgress({}); setMessage('')
  }

  async function upload(field: AssetField, file?: File) {
    if (!file) return
    setMessage(''); setProgress((value) => ({ ...value, [field]: 0 }))
    try {
      if (field === 'svg') setSvgSource(sanitizeSvgMarkup(await file.text()))
      const asset: UploadedAsset = await uploadAdminFile(file, 'template', 'design-editor/templates', (percent) => setProgress((value) => ({ ...value, [field]: percent })))
      setAssets((value) => ({ ...value, [field]: asset }))
      setMessage(`${definitions.find((item) => item.field === field)?.label} uploaded.`)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'The template asset could not be uploaded.') }
  }

  async function sourceForGeneration() {
    if (svgSource) return svgSource
    if (!assets.svg?.url) throw new Error('Upload an SVG source before generating the template.')
    const response = await fetch(assets.svg.url, { cache: 'no-store' })
    if (!response.ok) throw new Error('The existing SVG source could not be loaded for regeneration.')
    return sanitizeSvgMarkup(await response.text())
  }

  function updateSize(index: number, values: Partial<SizeRow>) {
    setSizes((current) => current.map((size, position) => position === index ? { ...size, ...values } : values.isDefault ? { ...size, isDefault: false } : size))
  }

  async function save(event: React.FormEvent) {
    event.preventDefault(); if (saving) return; setSaving(true)
    try {
      if (!assets.previewImage || !assets.svg) throw new Error('Upload both a preview image and an SVG source.')
      if (!sizes.length) throw new Error('Add at least one supported size.')
      const svgChanged = !editing || editing.svgKey !== assets.svg.key
      const checksumChanged = !editing || Boolean(assets.svg.checksum && assets.svg.checksum !== editing.svgChecksum)
      const shouldGenerate = !editing || svgChanged || checksumChanged || regenerate || editing.conversionVersion !== 1 || editing.conversionStatus !== 'ready'
      setMessage(shouldGenerate ? 'Conversion status: Processing. Generating editable canvas once...' : 'Reusing the cached Fabric JSON...')
      const generated = shouldGenerate ? await generateFabricJsonFromSvg(await sourceForGeneration(), Number(form.width), Number(form.height), form.unit) : null
      const response = await fetch(editing ? `/api/admin/templates/${editing.id}` : '/api/admin/templates', {
        method: editing ? 'PUT' : 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...form, assets, sizes, svgChecksum: assets.svg.checksum || editing?.svgChecksum, conversionVersion: 1, regenerate, canvasData: generated?.canvasData, scaleMetadata: generated ? { widthMm: generated.widthMm, heightMm: generated.heightMm, pixelsPerMm: generated.pixelsPerMm, sourceObjectCount: generated.sourceObjectCount, sourceToCanvasScale: generated.scale } : null }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error?.message || 'The template could not be saved.')
      const success = shouldGenerate ? 'Conversion status: Ready. Fabric JSON generated and cached.' : 'Template updated. Cached Fabric JSON reused.'
      start(); await load(); setMessage(success)
    } catch (error) { setMessage(`Conversion status: Failed. ${error instanceof Error ? error.message : 'The template could not be saved.'}`) }
    finally { setSaving(false) }
  }

  async function remove(row: TemplateRow) {
    if (!window.confirm(`Delete “${row.name}”? Associated products must be detached first.`)) return
    const response = await fetch(`/api/admin/templates/${row.id}`, { method: 'DELETE' })
    const payload = await response.json()
    if (!response.ok) return setMessage(payload.error?.message || 'The template could not be deleted.')
    setMessage('Template deleted.'); await load()
  }

  if (isPending) return <div className="grid min-h-screen place-items-center">Loading...</div>
  if (!session?.user || getUserRole(session.user) !== 'admin') return <div className="grid min-h-screen place-items-center"><Link href={adminPath('/login')}>Admin sign in required</Link></div>
  return <main className="min-h-screen bg-background px-4 py-8"><div className="mx-auto max-w-6xl">
    <div className="flex items-center justify-between"><div><Link href={adminPath()} className="inline-flex items-center gap-2 text-sm font-semibold"><ArrowLeft className="h-4 w-4" /> Dashboard</Link><h1 className="mt-2 text-3xl font-black">Editable templates</h1></div><Button onClick={() => start()}><Plus /> New template</Button></div>
    {message && <p role="status" className="mt-5 rounded-md bg-secondary p-3 text-sm">{message}</p>}
    <form onSubmit={save} className="mt-6 rounded-xl border bg-card p-6"><h2 className="text-xl font-bold">{editing ? `Edit ${editing.name}` : 'Create from SVG'}</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Template name<Input className="mt-2" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label className="text-sm font-semibold">Category<select className="mt-2 h-10 w-full rounded-md border bg-background px-3" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{[['custom_banners','Custom banners'],['mesh_banners','Mesh banners'],['vinyl_banners','Vinyl banners'],['templates','Templates'],['digital_designs','Digital designs']].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="text-sm font-semibold sm:col-span-2">Optional description<textarea className="mt-2 min-h-24 w-full rounded-md border bg-background p-3" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><label className="text-sm font-semibold">Status<select className="mt-2 h-10 w-full rounded-md border bg-background px-3" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="draft">Draft</option><option value="active">Enabled</option><option value="inactive">Disabled</option></select></label></div>
      <fieldset className="mt-5 rounded-lg border p-4"><legend className="px-2 text-sm font-bold">Base design size</legend><p className="mb-3 text-xs text-muted-foreground">This establishes the original design coordinate system. Customer sizes scale from the cached original and do not trigger reconversion.</p><div className="grid grid-cols-3 gap-3"><label className="text-xs font-semibold">Width<Input required type="number" min="0.01" step="0.001" className="mt-1" value={form.width} onChange={(event) => setForm({ ...form, width: event.target.value })} /></label><label className="text-xs font-semibold">Height<Input required type="number" min="0.01" step="0.001" className="mt-1" value={form.height} onChange={(event) => setForm({ ...form, height: event.target.value })} /></label><label className="text-xs font-semibold">Unit<select className="mt-1 h-10 w-full rounded border px-2" value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value as MeasurementUnit })}>{['mm','cm','in','ft','m'].map((unit) => <option key={unit}>{unit}</option>)}</select></label></div></fieldset>
      <fieldset className="mt-5 rounded-lg border p-4"><div className="flex items-center justify-between"><legend className="px-2 text-sm font-bold">Supported product sizes</legend><Button type="button" size="sm" variant="outline" onClick={() => setSizes((current) => [...current, { ...blankSize(), isDefault: false, label: '' }])}><Plus /> Add size</Button></div><div className="mt-3 space-y-3">{sizes.map((size, index) => <div key={size.id || index} className="grid gap-2 rounded border p-3 sm:grid-cols-[1.4fr_.7fr_.7fr_.6fr_.8fr_auto_auto]"><Input aria-label="Size label" placeholder="Label" value={size.label} onChange={(e) => updateSize(index, { label: e.target.value })} /><Input aria-label="Width" type="number" min="0.01" value={size.width} onChange={(e) => updateSize(index, { width: e.target.value })} /><Input aria-label="Height" type="number" min="0.01" value={size.height} onChange={(e) => updateSize(index, { height: e.target.value })} /><select aria-label="Unit" className="rounded border px-2" value={size.unit} onChange={(e) => updateSize(index, { unit: e.target.value as MeasurementUnit })}>{['mm','cm','in','ft','m'].map((unit) => <option key={unit}>{unit}</option>)}</select><select aria-label="Fit mode" className="rounded border px-2" value={size.fitMode} onChange={(e) => updateSize(index, { fitMode: e.target.value as FitMode })}>{['contain','cover','stretch'].map((mode) => <option key={mode}>{mode}</option>)}</select><label className="flex items-center gap-1 text-xs"><input type="radio" name="default-size" checked={size.isDefault} onChange={() => updateSize(index, { isDefault: true })} /> Default</label><button type="button" aria-label="Remove size" disabled={sizes.length === 1} onClick={() => setSizes((current) => current.filter((_, position) => position !== index))} className="rounded border p-2 text-red-600 disabled:opacity-30"><Trash2 className="h-4 w-4" /></button></div>)}</div></fieldset>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">{definitions.map(({ field, label, accept, icon: Icon }) => { const asset = assets[field]; return <div key={field} className="rounded-lg border p-4"><div className="flex items-center gap-2 font-semibold"><Icon className="h-4 w-4 text-primary" /> {label}</div>{field === 'previewImage' && asset?.url ? <img src={asset.url} alt="Template preview" className="mt-3 h-28 w-full rounded object-cover" /> : <p className="mt-3 truncate text-xs">{asset?.filename || asset?.key || 'No file selected.'}</p>}<label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded border px-3 py-2 text-xs font-semibold"><Upload className="h-3 w-3" /> {asset ? 'Replace' : 'Choose file'}<input type="file" accept={accept} className="sr-only" onChange={(event) => void upload(field, event.target.files?.[0])} /></label>{progress[field] !== undefined && progress[field]! < 100 && <p className="mt-2 text-xs">Uploading {progress[field]}%</p>}</div> })}</div>
      {editing && <label className="mt-5 flex items-center gap-2 text-sm"><input type="checkbox" checked={regenerate} onChange={(event) => setRegenerate(event.target.checked)} /> <RefreshCw className="h-4 w-4" /> Explicitly regenerate cached Fabric JSON</label>}
      <div className="mt-6 flex gap-3"><Button type="submit" disabled={saving}>{saving ? 'Processing...' : editing ? 'Update template' : 'Create template'}</Button>{editing && <Button type="button" variant="outline" onClick={() => start()}>Cancel</Button>}</div>
    </form>
    <section className="mt-6 overflow-hidden rounded-xl border bg-card"><div className="border-b p-4 font-bold">Stored templates</div>{loading ? <p className="p-8 text-center">Loading...</p> : rows.length === 0 ? <p className="p-8 text-center text-muted-foreground">No templates have been created.</p> : <ul className="divide-y">{rows.map((row) => <li key={row.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center"><div className="flex min-w-0 flex-1 items-center gap-3">{row.previewImageUrl ? <img src={row.previewImageUrl} alt={`${row.name} preview`} className="h-14 w-14 rounded object-cover" /> : <FileCode2 />}<div><p className="font-semibold">{row.name}</p><p className="text-xs text-muted-foreground">{row.status} · {row.sizes.length} size(s) · v{row.templateVersion}</p><p className={`text-xs font-semibold ${row.conversionStatus === 'ready' ? 'text-green-700' : row.conversionStatus === 'failed' ? 'text-red-700' : 'text-amber-700'}`}>Conversion: {row.conversionStatus}{row.generatedAt ? ` · ${new Date(row.generatedAt).toLocaleString()}` : ''}</p>{row.conversionError && <p className="text-xs text-red-700">{row.conversionError}</p>}</div></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => start(row)}><Edit2 /> Edit</Button><Button size="sm" variant="outline" className="text-red-600" onClick={() => void remove(row)}><Trash2 /> Delete</Button></div></li>)}</ul>}</section>
  </div></main>
}
