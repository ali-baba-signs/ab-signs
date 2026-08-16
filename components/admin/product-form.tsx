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
import { BANNER_SIZE_PRESETS, FLAG_SIZE_GROUPS, FLAG_TYPES, PRODUCT_SIZE_MODES, SIDE_MODES, type ProductSizeMode } from '@/lib/products/size-presets'

interface Category { id: string; name: string }
interface Template { id: string; name: string; status: string; conversionStatus: string; sizes: Array<{ id: string; label: string; width: string; height: string; unit: string; enabled: boolean }> }
type ImageStatus = 'pending' | 'uploading' | 'uploaded' | 'failed'
interface ImageRow {
  clientId: string
  id?: string
  assetId?: string
  key?: string
  url: string
  alt: string
  isPrimary: boolean
  status: ImageStatus
  progress?: number
  file?: File
  fingerprint?: string
  error?: string
}
interface ApiImage { id: string; assetId?: string; storageKey?: string; key?: string; url: string; alt: string; isPrimary: boolean }
interface TemplatePriceRow { templateSizeId: string; label: string; dimensions: string; unitPrice: string; enabled: boolean }
interface StandaloneSizeRow { id?: string; label: string; width: string; height: string; unit: string; unitPrice: string; enabled: boolean; variantType: string; sizeGroup: string; sideMode: string; assembledHeightDescription:string; frontTemplateId:string; backTemplateId:string }
interface ProductData { id: string; sku: string; name: string; description: string; basePrice: string; categoryId: string; templateId: string | null; sizeMode: ProductSizeMode; allowCustomDimensions: boolean; featured: boolean; active: boolean; images: ApiImage[]; sizes: Array<StandaloneSizeRow & { id: string }> }

const blankSize = (): StandaloneSizeRow => ({ label: '500 × 1000 mm', height: '500', width: '1000', unit: 'mm', unitPrice: '0', enabled: true, variantType: '', sizeGroup: '', sideMode: 'single', assembledHeightDescription:'', frontTemplateId:'', backTemplateId:'' })

export function ProductForm({ productId }: { productId?: string }) {
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [form, setForm] = useState({ sku: '', name: '', description: '', basePrice: '', categoryId: '', templateId: '', sizeMode: 'preset_sizes' as ProductSizeMode, allowCustomDimensions: false, featured: false, active: true })
  const [images, setImages] = useState<ImageRow[]>([])
  const [templatePrices, setTemplatePrices] = useState<TemplatePriceRow[]>([])
  const [standaloneSizes, setStandaloneSizes] = useState<StandaloneSizeRow[]>([blankSize()])
  const [fixedVariantTemplateId, setFixedVariantTemplateId] = useState('')
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
        const response = await fetch('/api/admin/products', { cache: 'no-store' })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error?.message || 'Products could not be loaded.')
        setCategories(payload.data.categories)
        setTemplates(payload.data.templates)
        if (productId) {
          const product = payload.data.products.find((item: ProductData) => item.id === productId) as ProductData | undefined
          if (!product) throw new Error('Product not found.')
          setForm({ sku: product.sku, name: product.name, description: product.description || '', basePrice: product.basePrice, categoryId: product.categoryId, templateId: product.templateId || '', sizeMode: product.templateId ? 'template_sizes' : product.sizeMode || 'preset_sizes', allowCustomDimensions: Boolean(product.allowCustomDimensions), featured: Boolean(product.featured), active: product.active !== false })
          setImages(product.images.map((image) => ({ clientId: `existing:${image.id}`, id: image.id, assetId: image.assetId, key: image.storageKey || image.key, url: image.url, alt: image.alt || product.name, isPrimary: Boolean(image.isPrimary), status: 'uploaded' })))
          setTemplatePrices(product.templateId && product.sizeMode === 'template_sizes' ? product.sizes.map((size) => ({ templateSizeId: size.id, label: size.label, dimensions: `${size.height} × ${size.width} ${size.unit}`, unitPrice: String(size.unitPrice), enabled: Boolean(size.enabled) })) : [])
          if (product.sizeMode !== 'template_sizes') setStandaloneSizes(product.sizes.map((size) => ({ id: size.id, label: size.label, width: String(size.width || ''), height: String(size.height || ''), unit: size.unit, unitPrice: String(size.unitPrice), enabled: Boolean(size.enabled), variantType: size.variantType || '', sizeGroup: size.sizeGroup || '', sideMode: size.sideMode || 'single', assembledHeightDescription:size.assembledHeightDescription||'', frontTemplateId:size.frontTemplateId||'', backTemplateId:size.backTemplateId||'' })))
          if (product.templateId && product.sizeMode === 'fixed_variants') { setFixedVariantTemplateId(product.templateId); setForm((current) => ({ ...current, templateId: '' })) }
        } else if (payload.data.categories[0]) {
          setForm((current) => ({ ...current, categoryId: payload.data.categories[0].id }))
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'The form could not be loaded.')
      } finally {
        setLoading(false)
      }
    })()
  }, [productId])

  async function uploadImage(clientId: string, file: File) {
    setImages((current) => current.map((item) => item.clientId === clientId ? { ...item, status: 'uploading', progress: 0, error: undefined } : item))
    try {
      const asset = await uploadAdminFile(file, 'product-image', 'products', (progress) => setImages((current) => current.map((item) => item.clientId === clientId ? { ...item, progress } : item)))
      setImages((current) => current.map((item) => {
        if (item.clientId !== clientId) return item
        if (item.url.startsWith('blob:')) URL.revokeObjectURL(item.url)
        return { ...item, assetId: asset.id, key: asset.key, url: asset.url, status: 'uploaded', progress: 100, file: undefined }
      }))
    } catch (err) {
      setImages((current) => current.map((item) => item.clientId === clientId ? { ...item, status: 'failed', error: err instanceof Error ? err.message : 'Upload failed.' } : item))
    }
  }

  async function selectImages(files: FileList | null) {
    if (!files?.length) return
    const known = new Set(images.map((image) => image.fingerprint).filter(Boolean))
    const selected = Array.from(files).filter((file) => {
      const fingerprint = `${file.name}:${file.size}:${file.lastModified}`
      if (known.has(fingerprint)) return false
      known.add(fingerprint)
      return true
    })
    if (images.length + selected.length > 12) return setError('A product can have up to 12 images.')
    const rows: ImageRow[] = selected.map((file, index) => ({ clientId: crypto.randomUUID(), url: URL.createObjectURL(file), alt: form.name || file.name, isPrimary: images.length === 0 && index === 0, status: 'pending', progress: 0, file, fingerprint: `${file.name}:${file.size}:${file.lastModified}` }))
    setError('')
    setImages((current) => [...current, ...rows])
    for (const row of rows) await uploadImage(row.clientId, row.file!)
  }

  async function removeImage(index: number) {
    const image = images[index]
    if (!image.id && image.key) {
      try { await removeAdminUpload(image.key) }
      catch (err) { return setError(err instanceof Error ? err.message : 'Image cleanup failed.') }
    }
    if (image.url.startsWith('blob:')) URL.revokeObjectURL(image.url)
    const next = images.filter((_, position) => position !== index)
    if (image.isPrimary && next[0]) next[0] = { ...next[0], isPrimary: true }
    setImages(next)
  }

  function moveImage(index: number, direction: -1 | 1) {
    const next = [...images]
    const target = index + direction
    if (!next[target]) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setImages(next)
  }

  function selectTemplate(templateId: string) {
    if (form.sizeMode === 'fixed_variants') { setFixedVariantTemplateId(templateId); return }
    setForm((current) => ({ ...current, templateId, sizeMode: templateId ? 'template_sizes' : 'preset_sizes' }))
    const template = templates.find((item) => item.id === templateId)
    setTemplatePrices(template ? template.sizes.filter((size) => size.enabled).map((size) => ({ templateSizeId: size.id, label: size.label, dimensions: `${size.width} x ${size.height} ${size.unit}`, unitPrice: form.basePrice || '0', enabled: true })) : [])
  }

  function addBannerPreset(height: number, width: number) {
    if (standaloneSizes.some((size) => size.height === String(height) && size.width === String(width) && size.unit === 'mm')) return
    setStandaloneSizes((current) => [...current, { ...blankSize(), height: String(height), width: String(width), label: `${height} × ${width} mm`, unitPrice: form.basePrice || '0' }])
  }

  function addFlagVariant() {
    setForm((current) => ({ ...current, sizeMode: 'fixed_variants', allowCustomDimensions: false }))
    setStandaloneSizes((current) => [...current, { ...blankSize(), label: 'Feather / Small / Single-sided', height: '', width: '', variantType: 'feather', sizeGroup: 'small', sideMode: 'single', unitPrice: form.basePrice || '0' }])
  }

  function changeSizeMode(sizeMode: ProductSizeMode) {
    const attachedTemplate = form.templateId || fixedVariantTemplateId
    if (sizeMode === 'fixed_variants') {
      setFixedVariantTemplateId(attachedTemplate)
      setForm((current) => ({ ...current, templateId: '', sizeMode, allowCustomDimensions: false }))
      return
    }
    setFixedVariantTemplateId('')
    setForm((current) => ({ ...current, templateId: attachedTemplate, sizeMode, allowCustomDimensions: current.allowCustomDimensions }))
    if (sizeMode === 'template_sizes' && attachedTemplate) {
      const template = templates.find((item) => item.id === attachedTemplate)
      setTemplatePrices(template ? template.sizes.filter((size) => size.enabled).map((size) => ({ templateSizeId: size.id, label: size.label, dimensions: `${size.height} × ${size.width} ${size.unit}`, unitPrice: form.basePrice || '0', enabled: true })) : [])
    }
  }

  async function createCategory() {
    if (creatingCategory) return
    setCreatingCategory(true); setError('')
    try {
      const response = await fetch('/api/admin/categories', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: newCategory }) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error?.message || 'Category could not be created.')
      const category = payload.data.category as Category
      setCategories((current) => [...current, category].sort((left, right) => left.name.localeCompare(right.name)))
      setForm((current) => ({ ...current, categoryId: category.id }))
      setNewCategory('')
      setSuccess(`Category “${category.name}” created and selected.`)
    } catch (err) { setError(err instanceof Error ? err.message : 'Category could not be created.') }
    finally { setCreatingCategory(false) }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (submitting) return
    const attention = images.findIndex((image) => !image.id && image.status !== 'uploaded')
    if (attention >= 0) return setError(`Image ${attention + 1} is ${images[attention].status}. Retry or remove it before saving.`)
    setSubmitting(true); setError(''); setSuccess('')
    try {
      const response = await fetch(productId ? `/api/admin/products/${productId}` : '/api/admin/products', {
        method: productId ? 'PUT' : 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...form, templateId: form.templateId || fixedVariantTemplateId || null, images: images.map((image, order) => ({ id: image.id, assetId: image.assetId, key: image.key, url: image.url, alt: image.alt, isPrimary: image.isPrimary, order })), templatePrices, sizes: form.sizeMode === 'template_sizes' ? [] : standaloneSizes }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error?.message || 'The product could not be saved.')
      setSuccess(productId ? 'Product updated successfully.' : 'Product created successfully.')
      if (!productId) router.push(adminPath(`/products/${payload.data.product.id}`)); else router.refresh()
    } catch (err) { setError(err instanceof Error ? err.message : 'The product could not be saved.') }
    finally { setSubmitting(false) }
  }

  if (loading) return <div className="grid min-h-[60vh] place-items-center"><span className="animate-pulse">Loading product form…</span></div>
  return <main className="min-h-screen bg-background px-4 py-8"><form onSubmit={submit} className="mx-auto max-w-6xl space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><Link href={adminPath('/products')} className="inline-flex items-center gap-2 text-sm font-semibold"><ArrowLeft className="h-4 w-4" /> Products</Link><h1 className="mt-2 text-3xl font-black">{productId ? 'Edit product' : 'Add product'}</h1></div><Button type="submit" disabled={submitting || uploadsInProgress}><Save /> {submitting ? 'Saving…' : uploadsInProgress ? 'Waiting for images…' : 'Save product'}</Button></div>
    {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-red-700">{error}</div>}{success && <div role="status" className="rounded-md border border-green-200 bg-green-50 p-3 text-green-700">{success}</div>}
    <section className="rounded-xl border bg-card p-6"><h2 className="text-xl font-bold">Product information</h2><div className="mt-5 grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-semibold">Product name<Input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-2" /></label>
      <label className="text-sm font-semibold">SKU<Input required value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} className="mt-2" /></label>
      <div className="text-sm font-semibold"><label>Category<select required value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })} className="mt-2 h-10 w-full rounded-md border bg-background px-3">{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><div className="mt-2 flex gap-2"><Input aria-label="New category name" placeholder="Add new category" value={newCategory} onChange={(event) => setNewCategory(event.target.value)} /><Button type="button" variant="outline" disabled={creatingCategory || newCategory.trim().length < 2} onClick={() => void createCategory()}>{creatingCategory ? 'Adding…' : 'Add'}</Button></div></div>
      <label className="text-sm font-semibold">Editable template<select value={form.templateId || fixedVariantTemplateId} onChange={(event) => selectTemplate(event.target.value)} className="mt-2 h-10 w-full rounded-md border bg-background px-3"><option value="">No template</option>{templates.filter((item) => item.status === 'active' && item.conversionStatus === 'ready').map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="text-sm font-semibold">Size mode<select value={form.sizeMode} onChange={(event) => changeSizeMode(event.target.value as ProductSizeMode)} className="mt-2 h-10 w-full rounded-md border bg-background px-3">{PRODUCT_SIZE_MODES.filter((mode) => mode !== 'template_sizes' || Boolean(form.templateId || fixedVariantTemplateId)).map((mode) => <option key={mode} value={mode}>{mode.replaceAll('_',' ')}</option>)}</select></label>
      <label className="text-sm font-semibold">Base price<Input required type="number" min="0" step="0.01" value={form.basePrice} onChange={(event) => setForm({ ...form, basePrice: event.target.value })} className="mt-2" /></label>
      <div className="flex items-center gap-5 pt-6"><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.featured} onChange={(event) => setForm({ ...form, featured: event.target.checked })} /> Featured</label><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Active</label></div>
    </div><div className="mt-5"><Label className="mb-2 block">Description</Label><RichTextEditor value={form.description} onChange={(description) => setForm({ ...form, description })} error={descriptionError} /></div></section>
    <section className="rounded-xl border bg-card p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Product images</h2><p className="text-sm text-muted-foreground">Every image shows its upload state. Failed uploads can be retried or removed.</p></div><label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><ImagePlus className="h-4 w-4" /> Add images<input type="file" multiple accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => { void selectImages(event.target.files); event.currentTarget.value = '' }} /></label></div>
      {images.length === 0 ? <p className="mt-6 rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">No images uploaded.</p> : <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{images.map((image, index) => <div key={image.clientId} className={`overflow-hidden rounded-lg border ${image.status === 'failed' ? 'border-red-400' : ''}`}><img src={image.url} alt={image.alt} className="h-40 w-full object-cover" /><div className="space-y-2 p-3"><div className="flex justify-between gap-2 text-xs"><span className={image.status === 'failed' ? 'font-bold text-red-600' : 'text-muted-foreground'}>{image.status}</span>{image.error && <span className="truncate text-red-600" title={image.error}>{image.error}</span>}</div><Input aria-label={`Alt text for image ${index + 1}`} value={image.alt} onChange={(event) => setImages((current) => current.map((item, position) => position === index ? { ...item, alt: event.target.value } : item))} />{image.status === 'uploading' && <div className="h-2 overflow-hidden rounded bg-secondary"><div className="h-full bg-primary" style={{ width: `${image.progress || 0}%` }} /></div>}<div className="flex gap-1"><button type="button" title="Set featured" onClick={() => setImages((current) => current.map((item, position) => ({ ...item, isPrimary: position === index })))} className="rounded border p-2"><Star className={`h-4 w-4 ${image.isPrimary ? 'fill-primary text-primary' : ''}`} /></button><button type="button" title="Move earlier" onClick={() => moveImage(index, -1)} disabled={index === 0} className="rounded border p-2 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button><button type="button" title="Move later" onClick={() => moveImage(index, 1)} disabled={index === images.length - 1} className="rounded border p-2 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>{image.status === 'failed' && image.file && <button type="button" title="Retry upload" onClick={() => void uploadImage(image.clientId, image.file!)} className="rounded border p-2 text-primary"><RotateCcw className="h-4 w-4" /></button>}<button type="button" title="Remove image" onClick={() => void removeImage(index)} className="ml-auto rounded border p-2 text-red-600"><Trash2 className="h-4 w-4" /></button></div></div></div>)}</div>}
    </section>
    <section className="rounded-xl border bg-card p-6"><h2 className="text-xl font-bold">Production sizes and variants</h2>{form.templateId ? <><p className="text-sm text-muted-foreground">Physical dimensions come from the selected template; this product stores only price and availability.</p><div className="mt-5 space-y-3">{templatePrices.map((price, index) => <div key={price.templateSizeId} className="grid items-center gap-3 rounded border p-3 sm:grid-cols-[1fr_1fr_160px_auto]"><div className="font-semibold">{price.label}</div><div className="text-sm text-muted-foreground">{price.dimensions}</div><Input aria-label={`${price.label} price`} type="number" min="0" step="0.01" value={price.unitPrice} onChange={(event) => setTemplatePrices((current) => current.map((row, position) => position === index ? { ...row, unitPrice: event.target.value } : row))} /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={price.enabled} onChange={(event) => setTemplatePrices((current) => current.map((row, position) => position === index ? { ...row, enabled: event.target.checked } : row))} /> Enabled</label></div>)}</div></> : <><div className="mt-3 flex flex-wrap items-center gap-2"><Button type="button" size="sm" variant="outline" onClick={() => setStandaloneSizes((current) => [...current, { ...blankSize(), unitPrice: form.basePrice || '0', label: '' }])}><Plus /> Custom size</Button><Button type="button" size="sm" variant="outline" onClick={addFlagVariant}><Plus /> Flag variant</Button>{form.sizeMode !== 'fixed_variants' && <label className="ml-auto flex items-center gap-2 text-sm"><input type="checkbox" checked={form.allowCustomDimensions} onChange={(event) => setForm({ ...form, allowCustomDimensions: event.target.checked })} /> Permit customer custom dimensions</label>}</div>{form.sizeMode !== 'fixed_variants' && <div className="mt-3 flex max-h-32 flex-wrap gap-1 overflow-auto rounded bg-secondary p-2">{BANNER_SIZE_PRESETS.map(([height,width]) => <button key={`${height}-${width}`} type="button" className="rounded border bg-background px-2 py-1 text-xs" onClick={() => addBannerPreset(height,width)}>{height} × {width} mm</button>)}</div>}<div className="mt-4 space-y-3">{standaloneSizes.map((size,index) => <div key={size.id || index} className="grid gap-2 rounded border p-3 md:grid-cols-4"><Input aria-label="Variant label" placeholder="Name" value={size.label} onChange={(event) => setStandaloneSizes((rows) => rows.map((row,i) => i===index ? {...row,label:event.target.value}:row))} />{form.sizeMode === 'fixed_variants' && <><select aria-label="Flag type" className="h-10 rounded border px-2" value={size.variantType} onChange={(event) => setStandaloneSizes((rows)=>rows.map((row,i)=>i===index?{...row,variantType:event.target.value}:row))}>{FLAG_TYPES.map((value)=><option key={value}>{value}</option>)}</select><select aria-label="Size group" className="h-10 rounded border px-2" value={size.sizeGroup} onChange={(event) => setStandaloneSizes((rows)=>rows.map((row,i)=>i===index?{...row,sizeGroup:event.target.value}:row))}>{FLAG_SIZE_GROUPS.map((value)=><option key={value}>{value}</option>)}</select><select aria-label="Print sides" className="h-10 rounded border px-2" value={size.sideMode} onChange={(event) => setStandaloneSizes((rows)=>rows.map((row,i)=>i===index?{...row,sideMode:event.target.value}:row))}>{SIDE_MODES.map((value)=><option key={value} value={value}>{value}-sided</option>)}</select></>}<Input aria-label="Print height" type="number" min="0.001" step="0.001" placeholder="Height" value={size.height} onChange={(event)=>setStandaloneSizes((rows)=>rows.map((row,i)=>i===index?{...row,height:event.target.value}:row))}/><Input aria-label="Print width" type="number" min="0.001" step="0.001" placeholder="Width" value={size.width} onChange={(event)=>setStandaloneSizes((rows)=>rows.map((row,i)=>i===index?{...row,width:event.target.value}:row))}/><select aria-label="Unit" className="h-10 rounded border px-2" value={size.unit} onChange={(event)=>setStandaloneSizes((rows)=>rows.map((row,i)=>i===index?{...row,unit:event.target.value}:row))}>{['mm','cm','in','ft','m'].map((unit)=><option key={unit}>{unit}</option>)}</select><Input aria-label="Unit price" type="number" min="0" step="0.01" value={size.unitPrice} onChange={(event)=>setStandaloneSizes((rows)=>rows.map((row,i)=>i===index?{...row,unitPrice:event.target.value}:row))}/><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={size.enabled} onChange={(event)=>setStandaloneSizes((rows)=>rows.map((row,i)=>i===index?{...row,enabled:event.target.checked}:row))}/> Enabled</label><Button type="button" variant="outline" className="text-red-600" disabled={standaloneSizes.length===1} onClick={()=>setStandaloneSizes((rows)=>rows.filter((_,i)=>i!==index))}><Trash2/> Remove</Button></div>)}</div></>}</section>
    {form.sizeMode==='fixed_variants'&&<section className="rounded-xl border bg-card p-6"><h2 className="text-xl font-bold">Flag production mapping</h2><p className="text-sm text-muted-foreground">Map each resolved style/size/printing combination to its canonical front and optional back template.</p><div className="mt-4 space-y-3">{standaloneSizes.map((size,index)=><div key={size.id||index} className="grid gap-3 rounded border p-3 lg:grid-cols-3"><div><p className="font-semibold">{size.label}</p><p className="text-xs text-muted-foreground">{size.variantType} · {size.sizeGroup} · {size.sideMode}</p></div><label className="text-sm font-semibold">Front template<select className="mt-1 h-10 w-full rounded border px-2" value={size.frontTemplateId} onChange={(event)=>setStandaloneSizes((rows)=>rows.map((row,i)=>i===index?{...row,frontTemplateId:event.target.value}:row))}><option value="">Use product template</option>{templates.filter((template)=>template.status==='active'&&template.conversionStatus==='ready').map((template)=><option key={template.id} value={template.id}>{template.name}</option>)}</select></label><label className="text-sm font-semibold">Back template<select className="mt-1 h-10 w-full rounded border px-2" value={size.backTemplateId} disabled={size.sideMode!=='double'} onChange={(event)=>setStandaloneSizes((rows)=>rows.map((row,i)=>i===index?{...row,backTemplateId:event.target.value}:row))}><option value="">Copy/use front</option>{templates.filter((template)=>template.status==='active'&&template.conversionStatus==='ready').map((template)=><option key={template.id} value={template.id}>{template.name}</option>)}</select></label><label className="text-sm font-semibold lg:col-span-3">Assembled height description<Input className="mt-1" placeholder="e.g. 2.4 m assembled height" value={size.assembledHeightDescription} onChange={(event)=>setStandaloneSizes((rows)=>rows.map((row,i)=>i===index?{...row,assembledHeightDescription:event.target.value}:row))}/></label></div>)}</div></section>}
    <div className="flex justify-end"><Button type="submit" size="lg" disabled={submitting || uploadsInProgress}><Save /> {submitting ? 'Saving…' : uploadsInProgress ? 'Waiting for images…' : 'Save product'}</Button></div>
  </form></main>
}
