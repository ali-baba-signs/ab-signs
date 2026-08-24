'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { ImageCropUpload } from '@/components/admin/image-crop-upload'

type AssetField = 'previewImage' | 'editableSvg' | 'fixedSvg'
interface AssetValue { id: string; key: string; url: string; filename?: string; checksum?: string }
interface SizeRow { id: string; label: string; width: string; height: string; unit: MeasurementUnit; enabled: boolean; isDefault: boolean; unitPrice: string; variantType?: string | null; sizeGroup?: string | null; assembledHeightDescription?: string | null }
interface ProductRow { id: string; name: string; categoryId: string; active: boolean; sizes: SizeRow[] }
interface ProductCategory { id: string; name: string; slug: string }
interface TemplateRow {
  id: string; productId: string | null; productIds: string[]; productName: string | null; categoryId: string | null; categoryName: string | null
  name: string; description: string | null; status: string; previewImageUrl: string | null; previewImageKey: string | null; previewAssetId: string | null
  svgUrl: string | null; svgKey: string | null; svgAssetId: string | null; svgChecksum: string | null; physicalWidth: string | null; physicalHeight: string | null
  fixedSvgUrl: string | null; fixedSvgKey: string | null; fixedSvgAssetId: string | null; templateKind: 'banner' | 'flag'; printableArea: { x: number; y: number; width: number; height: number } | null
  measurementUnit: MeasurementUnit | null; templateVersion: number; conversionVersion: number; conversionStatus: string; conversionError: string | null; generatedAt: string | null; sizes: SizeRow[]
}

const definitions = [
  { field: 'previewImage' as const, label: 'Preview image', accept: 'image/png,image/jpeg,image/webp', icon: ImageIcon },
  { field: 'editableSvg' as const, label: 'Editable artwork SVG', accept: 'image/svg+xml,.svg', icon: FileCode2 },
  { field: 'fixedSvg' as const, label: 'Fixed product shape / mask SVG', accept: 'image/svg+xml,.svg', icon: FileCode2 },
]
const emptyForm = { name: '', description: '', categoryId: '', productIds: [] as string[], status: 'draft', templateKind: 'banner' as 'banner' | 'flag', width: '', height: '', unit: 'mm' as MeasurementUnit }

function assetsOf(row: TemplateRow): Partial<Record<AssetField, AssetValue | null>> {
  return {
    previewImage: row.previewImageKey && row.previewAssetId ? { id: row.previewAssetId, key: row.previewImageKey, url: row.previewImageUrl || '' } : null,
    editableSvg: row.svgKey && row.svgAssetId ? { id: row.svgAssetId, key: row.svgKey, url: row.svgUrl || '', checksum: row.svgChecksum || undefined } : null,
    fixedSvg: row.fixedSvgKey && row.fixedSvgAssetId ? { id: row.fixedSvgAssetId, key: row.fixedSvgKey, url: row.fixedSvgUrl || '' } : null,
  }
}

export default function TemplatesPage() {
  const { data: session, isPending } = useAdminSession()
  const [rows, setRows] = useState<TemplateRow[]>([])
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [products, setProducts] = useState<ProductRow[]>([])
  const [editing, setEditing] = useState<TemplateRow | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [assets, setAssets] = useState<Partial<Record<AssetField, AssetValue | null>>>({})
  const [svgSources, setSvgSources] = useState<Partial<Record<'editableSvg' | 'fixedSvg', string>>>({})
  const [regenerate, setRegenerate] = useState(false)
  const [progress, setProgress] = useState<Partial<Record<AssetField, number>>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const filteredProducts = useMemo(() => products.filter((product) => product.active), [products])
  const selectedProducts = products.filter((product) => form.productIds.includes(product.id))
  const selectedProduct = selectedProducts[0]
  const inheritedSizes = selectedProducts.flatMap((product) => product.sizes.filter((size) => size.enabled).map((size) => ({ ...size, productId: product.id, productName: product.name })))

  function dimensionsFor(product?: ProductRow) {
    const sizes = product?.sizes.filter((size) => size.enabled) || []
    const size = sizes.find((item) => item.isDefault) || sizes[0]
    return size ? { width: String(size.width), height: String(size.height), unit: size.unit } : { width: '', height: '', unit: 'mm' as MeasurementUnit }
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/templates', { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error?.message || 'Templates could not be loaded.')
      setRows(payload.data.templates); setCategories(payload.data.categories || []); setProducts(payload.data.products || [])
      setForm((current) => {
        if (current.categoryId) return current
        const category = payload.data.categories?.[0]
        const product = payload.data.products?.find((item: ProductRow) => item.active && item.categoryId === category?.id)
        return { ...current, categoryId: category?.id || '', productIds: product ? [product.id] : [], ...dimensionsFor(product) }
      })
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Templates could not be loaded.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { if (getUserRole(session?.user) !== 'admin') return; const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer) }, [load, session?.user])

  function start(row?: TemplateRow) {
    setEditing(row || null)
    const categoryId = row?.categoryId || categories[0]?.id || ''
    const productIds = row?.productIds?.length ? row.productIds : row?.productId ? [row.productId] : []
    const product = products.find((item) => item.id === productIds[0]) || products.find((item) => item.active && item.categoryId === categoryId)
    setForm({ name: row?.name || '', description: row?.description || '', categoryId, productIds: productIds.length ? productIds : product ? [product.id] : [], status: row?.status || 'draft', templateKind: row?.templateKind || 'banner', ...dimensionsFor(product) })
    setAssets(row ? assetsOf(row) : {}); setSvgSources({}); setRegenerate(false); setProgress({}); setMessage('')
  }

  function chooseCategory(categoryId: string) {
    setForm((current) => ({ ...current, categoryId }))
  }

  function toggleProduct(productId: string) {
    const next = form.productIds.includes(productId) ? form.productIds.filter((id) => id !== productId) : [...form.productIds, productId]
    const primary = products.find((item) => item.id === next[0])
    setForm((current) => ({ ...current, productIds: next, categoryId: primary?.categoryId || current.categoryId, ...dimensionsFor(primary) }))
  }

  async function upload(field: AssetField, file?: File) {
    if (!file) return
    setMessage(''); setProgress((value) => ({ ...value, [field]: 0 }))
    try {
      if (field !== 'previewImage') {
        const source = sanitizeSvgMarkup(await file.text())
        setSvgSources((value) => ({ ...value, [field]: source }))
      }
      const asset: UploadedAsset = await uploadAdminFile(file, 'template', 'design-editor/templates', (percent) => setProgress((value) => ({ ...value, [field]: percent })))
      setAssets((value) => ({ ...value, [field]: asset })); setMessage(`${definitions.find((item) => item.field === field)?.label} uploaded.`)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'The template asset could not be uploaded.') }
  }

  async function sourceForGeneration(field: 'editableSvg' | 'fixedSvg') {
    if (svgSources[field]) return svgSources[field]!
    if (!assets[field]?.url) throw new Error(`Upload the ${field === 'fixedSvg' ? 'fixed shape' : 'editable artwork'} SVG before generating the template.`)
    const response = await fetch(`/api/admin/templates/source?assetId=${encodeURIComponent(assets[field]!.id)}`, { cache: 'no-store' })
    if (!response.ok) { const payload = await response.json().catch(() => null); throw new Error(payload?.error?.message || 'The SVG source could not be retrieved from storage.') }
    return sanitizeSvgMarkup(await response.text())
  }

  async function save(event: React.FormEvent) {
    event.preventDefault(); if (saving) return; setSaving(true)
    try {
      if (!assets.previewImage || !assets.editableSvg) throw new Error('Upload a preview image and editable artwork SVG.')
      if (form.templateKind === 'flag' && !assets.fixedSvg) throw new Error('Flag templates require a fixed product shape / mask SVG.')
      if (!selectedProduct || !inheritedSizes.length) throw new Error('Select a product with at least one enabled size.')
      const svgChanged = !editing || editing.svgKey !== assets.editableSvg.key || editing.fixedSvgKey !== assets.fixedSvg?.key
      const checksumChanged = !editing || Boolean(assets.editableSvg.checksum && assets.editableSvg.checksum !== editing.svgChecksum)
      const productChanged = Boolean(editing && [...(editing.productIds || [])].sort().join(',') !== [...form.productIds].sort().join(','))
      const shouldGenerate = !editing || svgChanged || checksumChanged || productChanged || regenerate || editing.conversionVersion !== 2 || editing.conversionStatus !== 'ready'
      setMessage(shouldGenerate ? 'Conversion status: Processing. Generating editable canvas once...' : 'Reusing the cached Fabric JSON...')
      const generated = shouldGenerate ? await generateFabricJsonFromSvg(await sourceForGeneration('editableSvg'), Number(form.width), Number(form.height), form.unit) : null
      const fixedGenerated = shouldGenerate && assets.fixedSvg ? await generateFabricJsonFromSvg(await sourceForGeneration('fixedSvg'), Number(form.width), Number(form.height), form.unit, { role: 'fixed-product-layer', inset: 1 }) : null
      const response = await fetch(editing ? `/api/admin/templates/${editing.id}` : '/api/admin/templates', {
        method: editing ? 'PUT' : 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...form,
          categoryId: selectedProduct?.categoryId || form.categoryId,
          assets,
          svgChecksum: assets.editableSvg.checksum || editing?.svgChecksum,
          conversionVersion: 2,
          regenerate: shouldGenerate,
          canvasData: generated?.canvasData,
          fixedCanvasData: fixedGenerated?.canvasData,
          printableArea: generated ? (form.templateKind === 'flag' && fixedGenerated ? fixedGenerated.printableArea : { x: 0, y: 0, width: generated.logicalCanvasWidth, height: generated.logicalCanvasHeight }) : editing?.printableArea,
          scaleMetadata: generated ? { widthMm: generated.widthMm, heightMm: generated.heightMm, pixelsPerMm: generated.pixelsPerMm, sourceObjectCount: generated.sourceObjectCount, sourceToCanvasScale: generated.scale, fixedSourceObjectCount: fixedGenerated?.sourceObjectCount || 0 } : null,
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error?.message || 'The template could not be saved.')
      start(); await load(); setMessage(shouldGenerate ? 'Conversion status: Ready. Product sizes inherited.' : 'Template updated. Product sizes remain inherited.')
    } catch (error) { setMessage(`Conversion status: Failed. ${error instanceof Error ? error.message : 'The template could not be saved.'}`) }
    finally { setSaving(false) }
  }

  async function remove(row: TemplateRow) {
    if (!window.confirm(`Delete “${row.name}”?`)) return
    const response = await fetch(`/api/admin/templates/${row.id}`, { method: 'DELETE' }); const payload = await response.json()
    if (!response.ok) return setMessage(payload.error?.message || 'The template could not be deleted.')
    setMessage(payload.data?.archived ? 'This template is used by saved designs or orders, so it was archived safely.' : 'Template deleted.'); await load()
  }

  if (isPending) return <div className="grid min-h-screen place-items-center">Loading...</div>
  if (!session?.user || getUserRole(session.user) !== 'admin') return <div className="grid min-h-screen place-items-center"><Link href={adminPath('/login')}>Admin sign in required</Link></div>
  return <main className="min-h-screen bg-background px-4 py-8"><div className="mx-auto max-w-6xl">
    <div className="flex items-center justify-between"><div><Link href={adminPath()} className="inline-flex items-center gap-2 text-sm font-semibold"><ArrowLeft className="h-4 w-4" /> Dashboard</Link><h1 className="mt-2 text-3xl font-black">Editable templates</h1></div><Button onClick={() => start()}><Plus /> New template</Button></div>
    {message && <p role="status" className="mt-5 rounded-md bg-secondary p-3 text-sm">{message}</p>}
    <form onSubmit={save} className="mt-6 rounded-xl border bg-card p-6"><h2 className="text-xl font-bold">{editing ? `Edit ${editing.name}` : 'Create from SVG'}</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Template name<Input className="mt-2" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label className="text-sm font-semibold">Status<select className="mt-2 h-10 w-full rounded-md border bg-background px-3" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="draft">Draft</option><option value="active">Enabled</option><option value="inactive">Disabled</option></select></label><label className="text-sm font-semibold">Product template type<select className="mt-2 h-10 w-full rounded-md border bg-background px-3" value={form.templateKind} onChange={(event) => setForm({ ...form, templateKind: event.target.value === 'flag' ? 'flag' : 'banner' })}><option value="banner">Banner — fixed rectangle</option><option value="flag">Flag — fixed silhouette and clipping mask</option></select></label><label className="text-sm font-semibold">Primary product category<select required className="mt-2 h-10 w-full rounded-md border bg-background px-3" value={form.categoryId} onChange={(event) => chooseCategory(event.target.value)}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><span className="mt-1 block text-xs font-normal text-muted-foreground">Used for legacy reporting only; compatible products may belong to any category.</span></label><fieldset className="rounded border p-3 sm:col-span-2"><legend className="px-1 text-sm font-semibold">Compatible products</legend><div className="max-h-40 space-y-2 overflow-auto">{filteredProducts.map((product) => <label key={product.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.productIds.includes(product.id)} onChange={() => toggleProduct(product.id)} /> {product.name} <span className="text-xs text-muted-foreground">({categories.find((category) => category.id === product.categoryId)?.name || 'Uncategorised'})</span></label>)}</div></fieldset><label className="text-sm font-semibold sm:col-span-2">Optional description<textarea className="mt-2 min-h-24 w-full rounded-md border bg-background p-3" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label></div>
      <fieldset className="mt-5 rounded-lg border p-4"><legend className="px-2 text-sm font-bold">Compatible product sizes</legend><p className="mb-3 text-xs text-muted-foreground">Read-only. Each selected product keeps its own enabled production sizes; size-level template assignments can narrow availability further.</p>{inheritedSizes.length ? <div className="grid gap-2 sm:grid-cols-2">{inheritedSizes.map((size) => <div key={`${size.productId}:${size.id}`} className="rounded border bg-secondary/40 p-3"><p className="text-xs font-bold text-primary">{size.productName}</p><p className="font-semibold">{size.label}</p><p className="text-xs text-muted-foreground">{size.height} × {size.width} {size.unit} · {size.isDefault ? 'Default canvas' : 'Inherited'}</p>{size.assembledHeightDescription && <p className="text-xs text-muted-foreground">{size.assembledHeightDescription}</p>}</div>)}</div> : <p className="rounded border border-dashed p-5 text-sm text-muted-foreground">Select products with enabled sizes.</p>}</fieldset>
      <fieldset className="mt-5 rounded-lg border p-4"><legend className="px-2 text-sm font-bold">Base artwork canvas</legend><p className="mb-3 text-xs text-muted-foreground">Automatically uses the product default size.</p><div className="grid grid-cols-3 gap-3"><label className="text-xs font-semibold">Width<Input readOnly className="mt-1" value={form.width} /></label><label className="text-xs font-semibold">Height<Input readOnly className="mt-1" value={form.height} /></label><label className="text-xs font-semibold">Unit<Input readOnly className="mt-1" value={form.unit} /></label></div></fieldset>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <ImageCropUpload label="Template preview image" recommendedWidth={1600} recommendedHeight={900} value={assets.previewImage?.url || undefined} onCropped={(file) => upload('previewImage', file)} />
        {definitions.filter(({ field }) => field !== 'previewImage' && (field !== 'fixedSvg' || form.templateKind === 'flag')).map(({ field, label, accept, icon: Icon }) => { const asset = assets[field]; return <div key={field} className="rounded-lg border p-4"><div className="flex items-center gap-2 font-semibold"><Icon className="h-4 w-4 text-primary" /> {label}</div><p className="mt-2 text-xs text-muted-foreground">{field === 'fixedSvg' ? 'Non-editable product silhouette, print boundary, and clipping mask.' : 'Only artwork from this file appears in the editable layer list.'}</p><p className="mt-3 truncate text-xs">{asset?.filename || asset?.key || 'No file selected.'}</p><label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded border px-3 py-2 text-xs font-semibold"><Upload className="h-3 w-3" /> {asset ? 'Replace' : 'Choose file'}<input type="file" accept={accept} className="sr-only" onChange={(event) => void upload(field, event.target.files?.[0])} /></label>{progress[field] !== undefined && progress[field]! < 100 && <p className="mt-2 text-xs">Uploading {progress[field]}%</p>}</div> })}
      </div>
      {editing && <label className="mt-5 flex items-center gap-2 text-sm"><input type="checkbox" checked={regenerate} onChange={(event) => setRegenerate(event.target.checked)} /> <RefreshCw className="h-4 w-4" /> Explicitly regenerate cached Fabric JSON</label>}
      <div className="mt-6 flex gap-3"><Button type="submit" disabled={saving || !form.productIds.length || !inheritedSizes.length}>{saving ? 'Processing...' : editing ? 'Update template' : 'Create template'}</Button>{editing && <Button type="button" variant="outline" onClick={() => start()}>Cancel</Button>}</div>
    </form>
    <section className="mt-6 overflow-hidden rounded-xl border bg-card"><div className="border-b p-4 font-bold">Stored templates</div>{loading ? <p className="p-8 text-center">Loading...</p> : rows.length === 0 ? <p className="p-8 text-center text-muted-foreground">No templates have been created.</p> : <ul className="divide-y">{rows.map((row) => <li key={row.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center"><div className="flex min-w-0 flex-1 items-center gap-3">{row.previewImageUrl ? <img src={row.previewImageUrl} alt={`${row.name} preview`} className="h-14 w-14 rounded object-cover" /> : <FileCode2 />}<div><p className="font-semibold">{row.name}</p><p className="text-xs text-muted-foreground">{row.categoryName || 'Unassigned'} → {row.productName || 'Legacy template'} · {row.sizes.filter((size) => size.enabled).length} inherited size(s) · v{row.templateVersion}</p><p className={`text-xs font-semibold ${row.conversionStatus === 'ready' ? 'text-green-700' : row.conversionStatus === 'failed' ? 'text-red-700' : 'text-amber-700'}`}>Conversion: {row.conversionStatus}</p></div></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => start(row)}><Edit2 /> Edit</Button><Button size="sm" variant="outline" className="text-red-600" onClick={() => void remove(row)}><Trash2 /> Delete</Button></div></li>)}</ul>}</section>
  </div></main>
}
