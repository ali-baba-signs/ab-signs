'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowDown, ArrowLeft, ArrowUp, ImagePlus, Plus, RotateCcw, Save, Star, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RichTextEditor } from '@/components/admin/rich-text-editor'
import { adminPath } from '@/lib/auth/admin-path'
import { removeAdminUpload, uploadAdminFile } from '@/lib/storage/upload-client'
import { BANNER_SIZE_PRESETS, FLAG_PRINT_PRESETS, FLAG_SIZE_GROUPS, FLAG_TYPES, PRODUCT_SIZE_MODES, SIDE_MODES, type ProductSizeMode } from '@/lib/products/size-presets'

interface Category { id: string; name: string }
type ImageStatus = 'pending' | 'uploading' | 'uploaded' | 'failed'
interface ImageRow { clientId: string; id?: string; assetId?: string; key?: string; url: string; alt: string; isPrimary: boolean; status: ImageStatus; progress?: number; file?: File; fingerprint?: string; error?: string }
interface ApiImage { id: string; assetId?: string; storageKey?: string; key?: string; url: string; alt: string; isPrimary: boolean }
interface SizeRow { id?: string; label: string; width: string; height: string; unit: string; unitPrice: string; enabled: boolean; variantType: string; sizeGroup: string; sideMode: string; assembledHeightDescription: string; fitMode: 'contain' | 'cover' | 'stretch'; safeMargin: string; bleed: string; trimMarks: boolean; isDefault: boolean }
interface ProductData { id: string; sku: string; name: string; description: string; basePrice: string; categoryId: string; sizeMode: ProductSizeMode; allowCustomDimensions: boolean; featured: boolean; active: boolean; images: ApiImage[]; sizes: Array<SizeRow & { id: string }> }

const blankSize = (): SizeRow => ({ label: '500 × 1000 mm', height: '500', width: '1000', unit: 'mm', unitPrice: '0', enabled: true, variantType: '', sizeGroup: '', sideMode: 'single', assembledHeightDescription: '', fitMode: 'contain', safeMargin: '0', bleed: '3', trimMarks: true, isDefault: true })

export function ProductForm({ productId }: { productId?: string }) {
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>([])
  const [form, setForm] = useState({ sku: '', name: '', description: '', basePrice: '', categoryId: '', sizeMode: 'preset_sizes' as ProductSizeMode, allowCustomDimensions: false, featured: false, active: true })
  const [images, setImages] = useState<ImageRow[]>([])
  const [sizes, setSizes] = useState<SizeRow[]>([blankSize()])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [newCategory, setNewCategory] = useState('')
  const [creatingCategory, setCreatingCategory] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const uploadsInProgress = images.some((image) => image.status === 'pending' || image.status === 'uploading')
  const descriptionError = useMemo(() => form.description.replace(/<[^>]*>/g, '').trim().length < 10 && error ? 'Enter at least 10 characters.' : '', [form.description, error])

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch('/api/admin/products', { cache: 'no-store' }); const payload = await response.json()
        if (!response.ok) throw new Error(payload.error?.message || 'Products could not be loaded.')
        setCategories(payload.data.categories)
        if (productId) {
          const product = payload.data.products.find((item: ProductData) => item.id === productId) as ProductData | undefined
          if (!product) throw new Error('Product not found.')
          setForm({ sku: product.sku, name: product.name, description: product.description || '', basePrice: product.basePrice, categoryId: product.categoryId, sizeMode: product.sizeMode === 'fixed_variants' ? 'fixed_variants' : product.sizeMode === 'custom_dimensions' ? 'custom_dimensions' : 'preset_sizes', allowCustomDimensions: Boolean(product.allowCustomDimensions), featured: Boolean(product.featured), active: product.active !== false })
          setImages(product.images.map((image) => ({ clientId: `existing:${image.id}`, id: image.id, assetId: image.assetId, key: image.storageKey || image.key, url: image.url, alt: image.alt || product.name, isPrimary: Boolean(image.isPrimary), status: 'uploaded' })))
          setSizes(product.sizes.map((size) => ({ id: size.id, label: size.label, width: String(size.width || ''), height: String(size.height || ''), unit: size.unit, unitPrice: String(size.unitPrice), enabled: Boolean(size.enabled), variantType: size.variantType || '', sizeGroup: size.sizeGroup || '', sideMode: size.sideMode || 'single', assembledHeightDescription: size.assembledHeightDescription || '', fitMode: size.fitMode || 'contain', safeMargin: String(size.safeMargin || '0'), bleed: String(size.bleed || '3'), trimMarks: size.trimMarks !== false, isDefault: Boolean(size.isDefault) })))
        } else if (payload.data.categories[0]) setForm((current) => ({ ...current, categoryId: payload.data.categories[0].id }))
      } catch (cause) { setError(cause instanceof Error ? cause.message : 'The form could not be loaded.') }
      finally { setLoading(false) }
    })()
  }, [productId])

  async function uploadImage(clientId: string, file: File) {
    setImages((current) => current.map((item) => item.clientId === clientId ? { ...item, status: 'uploading', progress: 0, error: undefined } : item))
    try {
      const asset = await uploadAdminFile(file, 'product-image', 'products', (progress) => setImages((current) => current.map((item) => item.clientId === clientId ? { ...item, progress } : item)))
      setImages((current) => current.map((item) => { if (item.clientId !== clientId) return item; if (item.url.startsWith('blob:')) URL.revokeObjectURL(item.url); return { ...item, assetId: asset.id, key: asset.key, url: asset.url, status: 'uploaded', progress: 100, file: undefined } }))
    } catch (cause) { setImages((current) => current.map((item) => item.clientId === clientId ? { ...item, status: 'failed', error: cause instanceof Error ? cause.message : 'Upload failed.' } : item)) }
  }

  async function selectImages(files: FileList | null) {
    if (!files?.length) return
    const known = new Set(images.map((image) => image.fingerprint).filter(Boolean))
    const selected = Array.from(files).filter((file) => { const fingerprint = `${file.name}:${file.size}:${file.lastModified}`; if (known.has(fingerprint)) return false; known.add(fingerprint); return true })
    if (images.length + selected.length > 12) return setError('A product can have up to 12 images.')
    const rows: ImageRow[] = selected.map((file, index) => ({ clientId: crypto.randomUUID(), url: URL.createObjectURL(file), alt: form.name || file.name, isPrimary: images.length === 0 && index === 0, status: 'pending', progress: 0, file, fingerprint: `${file.name}:${file.size}:${file.lastModified}` }))
    setError(''); setImages((current) => [...current, ...rows]); for (const row of rows) await uploadImage(row.clientId, row.file!)
  }

  async function removeImage(index: number) {
    const image = images[index]
    if (!image.id && image.key) { try { await removeAdminUpload(image.key) } catch (cause) { return setError(cause instanceof Error ? cause.message : 'Image cleanup failed.') } }
    if (image.url.startsWith('blob:')) URL.revokeObjectURL(image.url)
    const next = images.filter((_, position) => position !== index); if (image.isPrimary && next[0]) next[0] = { ...next[0], isPrimary: true }; setImages(next)
  }

  function moveImage(index: number, direction: -1 | 1) { const next = [...images]; const target = index + direction; if (!next[target]) return; [next[index], next[target]] = [next[target], next[index]]; setImages(next) }
  function updateSize(index: number, values: Partial<SizeRow>) { setSizes((current) => current.map((size, position) => position === index ? { ...size, ...values } : values.isDefault ? { ...size, isDefault: false } : size)) }
  function addBannerPreset(height: number, width: number) { if (sizes.some((size) => size.height === String(height) && size.width === String(width) && size.unit === 'mm')) return; setSizes((current) => [...current, { ...blankSize(), height: String(height), width: String(width), label: `${height} × ${width} mm`, unitPrice: form.basePrice || '0', isDefault: current.length === 0 }]) }
  function addFlagSizes() {
    setForm((current) => ({ ...current, sizeMode: 'fixed_variants', allowCustomDimensions: false }))
    setSizes((Object.entries(FLAG_PRINT_PRESETS) as Array<[keyof typeof FLAG_PRINT_PRESETS, typeof FLAG_PRINT_PRESETS[keyof typeof FLAG_PRINT_PRESETS]]>).map(([sizeGroup, preset], index) => ({ ...blankSize(), label: preset.label, height: String(preset.height), width: String(preset.width), unit: 'cm', variantType: 'feather', sizeGroup, sideMode: 'single', assembledHeightDescription: preset.assembledHeightDescription, unitPrice: form.basePrice || '0', isDefault: index === 0 })))
  }

  async function createCategory() {
    if (creatingCategory) return; setCreatingCategory(true); setError('')
    try { const response = await fetch('/api/admin/categories', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: newCategory }) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error?.message || 'Category could not be created.'); const category = payload.data.category as Category; setCategories((current) => [...current, category].sort((a, b) => a.name.localeCompare(b.name))); setForm((current) => ({ ...current, categoryId: category.id })); setNewCategory(''); setSuccess(`Category “${category.name}” created and selected.`) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Category could not be created.') } finally { setCreatingCategory(false) }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (submitting) return
    const attention = images.findIndex((image) => !image.id && image.status !== 'uploaded'); if (attention >= 0) return setError(`Image ${attention + 1} is ${images[attention].status}. Retry or remove it before saving.`)
    setSubmitting(true); setError(''); setSuccess('')
    try {
      const response = await fetch(productId ? `/api/admin/products/${productId}` : '/api/admin/products', { method: productId ? 'PUT' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...form, templateId: null, images: images.map((image, order) => ({ id: image.id, assetId: image.assetId, key: image.key, url: image.url, alt: image.alt, isPrimary: image.isPrimary, order })), sizes }) })
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error?.message || 'The product could not be saved.')
      setSuccess(productId ? 'Product updated successfully.' : 'Product created successfully.'); if (!productId) router.push(adminPath(`/products/${payload.data.product.id}`)); else router.refresh()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The product could not be saved.') } finally { setSubmitting(false) }
  }

  if (loading) return <div className="grid min-h-[60vh] place-items-center"><span className="animate-pulse">Loading product form…</span></div>
  return <main className="min-h-screen bg-background px-4 py-8"><form onSubmit={submit} className="mx-auto max-w-6xl space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><Link href={adminPath('/products')} className="inline-flex items-center gap-2 text-sm font-semibold"><ArrowLeft className="h-4 w-4" /> Products</Link><h1 className="mt-2 text-3xl font-black">{productId ? 'Edit product' : 'Add product'}</h1></div><Button type="submit" disabled={submitting || uploadsInProgress}><Save /> {submitting ? 'Saving…' : uploadsInProgress ? 'Waiting for images…' : 'Save product'}</Button></div>
    {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-red-700">{error}</div>}{success && <div role="status" className="rounded-md border border-green-200 bg-green-50 p-3 text-green-700">{success}</div>}
    <section className="rounded-xl border bg-card p-6"><h2 className="text-xl font-bold">Product information</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Product name<Input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-2" /></label><label className="text-sm font-semibold">SKU<Input placeholder="Leave blank to generate" value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} className="mt-2" /></label><div className="text-sm font-semibold"><label>Category<select required value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })} className="mt-2 h-10 w-full rounded-md border bg-background px-3">{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><div className="mt-2 flex gap-2"><Input aria-label="New category name" placeholder="Add new category" value={newCategory} onChange={(event) => setNewCategory(event.target.value)} /><Button type="button" variant="outline" disabled={creatingCategory || newCategory.trim().length < 2} onClick={() => void createCategory()}>{creatingCategory ? 'Adding…' : 'Add'}</Button></div></div><label className="text-sm font-semibold">Size mode<select value={form.sizeMode} onChange={(event) => setForm({ ...form, sizeMode: event.target.value as ProductSizeMode, allowCustomDimensions: event.target.value === 'fixed_variants' ? false : form.allowCustomDimensions })} className="mt-2 h-10 w-full rounded-md border bg-background px-3">{PRODUCT_SIZE_MODES.map((mode) => <option key={mode} value={mode}>{mode.replaceAll('_', ' ')}</option>)}</select><span className="mt-1 block text-xs font-normal text-muted-foreground">Templates automatically inherit enabled product sizes.</span></label><label className="text-sm font-semibold">Base price<Input required type="number" min="0" step="0.01" value={form.basePrice} onChange={(event) => setForm({ ...form, basePrice: event.target.value })} className="mt-2" /></label><div className="flex items-center gap-5 pt-6"><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.featured} onChange={(event) => setForm({ ...form, featured: event.target.checked })} /> Featured</label><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Active</label></div></div><div className="mt-5"><Label className="mb-2 block">Description</Label><RichTextEditor value={form.description} onChange={(description) => setForm({ ...form, description })} error={descriptionError} /></div></section>
    <section className="rounded-xl border bg-card p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Product images</h2><p className="text-sm text-muted-foreground">Every image shows its upload state.</p></div><label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><ImagePlus className="h-4 w-4" /> Add images<input type="file" multiple accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => { void selectImages(event.target.files); event.currentTarget.value = '' }} /></label></div>{images.length === 0 ? <p className="mt-6 rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">No images uploaded.</p> : <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{images.map((image, index) => <div key={image.clientId} className="overflow-hidden rounded-lg border"><img src={image.url} alt={image.alt} className="h-40 w-full object-cover" /><div className="space-y-2 p-3"><span className="text-xs text-muted-foreground">{image.status}</span><Input aria-label={`Alt text ${index + 1}`} value={image.alt} onChange={(event) => setImages((current) => current.map((item, position) => position === index ? { ...item, alt: event.target.value } : item))} /><div className="flex gap-1"><button type="button" title="Set featured" onClick={() => setImages((current) => current.map((item, position) => ({ ...item, isPrimary: position === index })))} className="rounded border p-2"><Star className={`h-4 w-4 ${image.isPrimary ? 'fill-primary text-primary' : ''}`} /></button><button type="button" title="Move earlier" onClick={() => moveImage(index, -1)} disabled={index === 0} className="rounded border p-2"><ArrowUp className="h-4 w-4" /></button><button type="button" title="Move later" onClick={() => moveImage(index, 1)} disabled={index === images.length - 1} className="rounded border p-2"><ArrowDown className="h-4 w-4" /></button>{image.status === 'failed' && image.file && <button type="button" title="Retry" onClick={() => void uploadImage(image.clientId, image.file!)} className="rounded border p-2"><RotateCcw className="h-4 w-4" /></button>}<button type="button" title="Remove" onClick={() => void removeImage(index)} className="ml-auto rounded border p-2 text-red-600"><Trash2 className="h-4 w-4" /></button></div></div></div>)}</div>}</section>
    <section className="rounded-xl border bg-card p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Production sizes</h2><p className="text-sm text-muted-foreground">The single source of truth for pricing, print dimensions, and template compatibility.</p></div><div className="flex gap-2"><Button type="button" size="sm" variant="outline" onClick={() => setSizes((current) => [...current, { ...blankSize(), unitPrice: form.basePrice || '0', label: '', isDefault: current.length === 0 }])}><Plus /> Custom size</Button><Button type="button" size="sm" variant="outline" onClick={addFlagSizes}><Plus /> Standard flag sizes</Button></div></div>{form.sizeMode !== 'fixed_variants' && <div className="mt-3 flex max-h-32 flex-wrap gap-1 overflow-auto rounded bg-secondary p-2">{BANNER_SIZE_PRESETS.map(([height, width]) => <button key={`${height}-${width}`} type="button" className="rounded border bg-background px-2 py-1 text-xs" onClick={() => addBannerPreset(height, width)}>{height} × {width} mm</button>)}</div>}<div className="mt-4 space-y-3">{sizes.map((size, index) => <div key={size.id || index} className="grid gap-2 rounded border p-3 md:grid-cols-4"><Input aria-label="Variant label" placeholder="Name" value={size.label} onChange={(event) => updateSize(index, { label: event.target.value })} />{form.sizeMode === 'fixed_variants' && <><select aria-label="Flag type" className="h-10 rounded border px-2" value={size.variantType} onChange={(event) => updateSize(index, { variantType: event.target.value })}>{FLAG_TYPES.map((value) => <option key={value}>{value}</option>)}</select><select aria-label="Size group" className="h-10 rounded border px-2" value={size.sizeGroup} onChange={(event) => updateSize(index, { sizeGroup: event.target.value })}>{FLAG_SIZE_GROUPS.map((value) => <option key={value}>{value}</option>)}</select><select aria-label="Print sides" className="h-10 rounded border px-2" value={size.sideMode} onChange={(event) => updateSize(index, { sideMode: event.target.value })}>{SIDE_MODES.map((value) => <option key={value}>{value}-sided</option>)}</select></>}<Input aria-label="Print height" type="number" min="0.001" step="0.001" value={size.height} readOnly={form.sizeMode === 'fixed_variants'} onChange={(event) => updateSize(index, { height: event.target.value })} /><Input aria-label="Print width" type="number" min="0.001" step="0.001" value={size.width} readOnly={form.sizeMode === 'fixed_variants'} onChange={(event) => updateSize(index, { width: event.target.value })} /><select aria-label="Unit" className="h-10 rounded border px-2" value={size.unit} disabled={form.sizeMode === 'fixed_variants'} onChange={(event) => updateSize(index, { unit: event.target.value })}>{['mm', 'cm', 'in', 'ft', 'm'].map((unit) => <option key={unit}>{unit}</option>)}</select><Input aria-label="Unit price" type="number" min="0" step="0.01" value={size.unitPrice} onChange={(event) => updateSize(index, { unitPrice: event.target.value })} /><select aria-label="Artwork fit" className="h-10 rounded border px-2" value={size.fitMode} onChange={(event) => updateSize(index, { fitMode: event.target.value as SizeRow['fitMode'] })}>{['contain', 'cover', 'stretch'].map((mode) => <option key={mode}>{mode}</option>)}</select><Input aria-label="Safe margin" type="number" min="0" step="0.001" value={size.safeMargin} onChange={(event) => updateSize(index, { safeMargin: event.target.value })} /><Input aria-label="Bleed" type="number" min="0" step="0.001" value={size.bleed} onChange={(event) => updateSize(index, { bleed: event.target.value })} />{form.sizeMode === 'fixed_variants' && <Input aria-label="Assembled height" value={size.assembledHeightDescription} onChange={(event) => updateSize(index, { assembledHeightDescription: event.target.value })} />}<label className="flex items-center gap-2 text-sm"><input type="radio" name="default-size" checked={size.isDefault} onChange={() => updateSize(index, { isDefault: true })} /> Default</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={size.trimMarks} onChange={(event) => updateSize(index, { trimMarks: event.target.checked })} /> Trim marks</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={size.enabled} onChange={(event) => updateSize(index, { enabled: event.target.checked })} /> Enabled</label><Button type="button" variant="outline" className="text-red-600" disabled={sizes.length === 1} onClick={() => setSizes((current) => current.filter((_, position) => position !== index))}><Trash2 /> Remove</Button></div>)}</div>{form.sizeMode !== 'fixed_variants' && <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={form.allowCustomDimensions} onChange={(event) => setForm({ ...form, allowCustomDimensions: event.target.checked })} /> Permit customer custom dimensions</label>}</section>
    <div className="flex justify-end"><Button type="submit" size="lg" disabled={submitting || uploadsInProgress}><Save /> {submitting ? 'Saving…' : 'Save product'}</Button></div>
  </form></main>
}
