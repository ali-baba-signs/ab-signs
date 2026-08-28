'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Copy, Eye, EyeOff, Lock, Trash2, Unlock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { listDesignTemplates } from '@/lib/editor/templates'
import { PRODUCT_PRESETS } from '@/lib/editor/editor-config'
import type { DesignTemplate, EditorObject, EditorSection, ProductConfig } from '@/lib/editor/types'

interface Props {
  active: EditorSection
  productConfig: ProductConfig
  productSizeLocked?: boolean
  objects: EditorObject[]
  selected: EditorObject | null
  onProductChange: (config: ProductConfig) => void
  onTemplate: (template: DesignTemplate) => void
  onAddText: (kind: 'heading' | 'subheading' | 'body') => void
  onUpload: (file: File) => void
  onGraphic: (path: string, name: string) => void
  onBackground: (color: string) => void
  onSelectLayer: (object: EditorObject) => void
  onLayerAction: (object: EditorObject, action: string) => void
  onChangeSelected: (values: Record<string, unknown>) => void
  onDuplicate: () => void
  onDelete: () => void
}

const colors = ['#ffffff', '#231f20', '#ed1b68', '#dc2626', '#145da0', '#16a34a', '#ffe600', '#f5f5f5']
const graphics = ['star', 'arrow', 'phone', 'email', 'badge']

function PanelTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-4 text-base font-bold text-zinc-900">{children}</h2>
}

export function EditorPanels(props: Props) {
  const [query, setQuery] = useState('')
  const [availableTemplates, setAvailableTemplates] = useState<DesignTemplate[]>([])
  const [templateState, setTemplateState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [templateError, setTemplateError] = useState('')
  useEffect(() => {
    let active = true
    void listDesignTemplates().then((items) => { if (active) { setAvailableTemplates(items); setTemplateState('ready') } }).catch((error) => { if (active) { setTemplateError(error instanceof Error ? error.message : 'Templates could not be loaded.'); setTemplateState('error') } })
    return () => { active = false }
  }, [])
  const templates = useMemo(
    () => availableTemplates.filter((item) => `${item.name} ${item.category}`.toLowerCase().includes(query.toLowerCase())),
    [availableTemplates, query],
  )

  return (
    <aside className="w-[270px] shrink-0 overflow-y-auto border-r border-zinc-200 bg-white p-4">
      {props.active === 'product' && <>
        <PanelTitle>Product options</PanelTitle>
        {props.productSizeLocked ? <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm"><p className="font-semibold">Size inherited from the selected template</p><p className="mt-1 text-zinc-600">{props.productConfig.widthMm.toFixed(1)} × {props.productConfig.heightMm.toFixed(1)} mm</p><p className="mt-2 text-xs text-zinc-500">Return to the product page to choose another supported size.</p></div> : <>
        <label className="mb-2 block text-xs font-semibold text-zinc-600">Size preset</label>
        <select
          className="h-10 w-full rounded-md border border-zinc-300 bg-white px-2 text-sm"
          onChange={(event) => props.onProductChange(PRODUCT_PRESETS[Number(event.target.value)].config)}
        >
          {PRODUCT_PRESETS.map((preset, index) => <option key={preset.name} value={index}>{preset.name}</option>)}
        </select>
        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <label>Width (mm)<Input type="number" value={props.productConfig.widthMm} onChange={(e) => props.onProductChange({ ...props.productConfig, widthMm: Number(e.target.value) })} /></label>
          <label>Height (mm)<Input type="number" value={props.productConfig.heightMm} onChange={(e) => props.onProductChange({ ...props.productConfig, heightMm: Number(e.target.value) })} /></label>
          <div className="rounded border bg-zinc-50 p-2 text-xs"><span className="font-semibold">Bleed</span><span className="block text-zinc-600">{props.productConfig.bleedMm} mm · set by admin</span></div>
          <div className="rounded border bg-zinc-50 p-2 text-xs"><span className="font-semibold">Safe area</span><span className="block text-zinc-600">{props.productConfig.safeMarginMm} mm · set by admin</span></div>
        </div>
        </>}
      </>}

      {props.active === 'templates' && <>
        <PanelTitle>Templates</PanelTitle>
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search templates" />
        {templateState === 'loading' && <p className="mt-4 text-sm text-zinc-500">Loading templates...</p>}
        {templateState === 'error' && <p role="alert" className="mt-4 text-sm text-red-700">{templateError}</p>}
        {templateState === 'ready' && !templates.length && <p className="mt-4 text-sm text-zinc-500">No enabled editable templates are available.</p>}
        <div className="mt-4 grid grid-cols-2 gap-3">
          {templates.map((template) => (
            <button key={template.id} type="button" onClick={() => props.onTemplate(template)} className="overflow-hidden rounded-md border border-zinc-200 text-left hover:border-[#ed1b68]">
              <img src={template.thumbnail} alt={`${template.name} preview`} className="aspect-[2/1] w-full object-cover" />
              <span className="block p-2 text-xs font-semibold">{template.name}</span>
            </button>
          ))}
        </div>
      </>}

      {props.active === 'text' && <>
        <PanelTitle>Text</PanelTitle>
        <div className="space-y-2">
          <Button variant="outline" className="w-full justify-start text-lg font-bold" onClick={() => props.onAddText('heading')}>Add heading</Button>
          <Button variant="outline" className="w-full justify-start font-semibold" onClick={() => props.onAddText('subheading')}>Add subheading</Button>
          <Button variant="outline" className="w-full justify-start text-sm font-normal" onClick={() => props.onAddText('body')}>Add body text</Button>
        </div>
      </>}

      {props.active === 'uploads' && <>
        <PanelTitle>Upload a logo or image</PanelTitle>
        <p className="mb-4 text-xs leading-5 text-zinc-500">PNG, JPEG, WEBP, or SVG. Maximum 10 MB.</p>
        <Input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e) => e.target.files?.[0] && props.onUpload(e.target.files[0])} />
      </>}

      {props.active === 'graphics' && <>
        <PanelTitle>Graphics</PanelTitle>
        <div className="grid grid-cols-3 gap-3">
          {graphics.map((name) => (
            <button key={name} type="button" onClick={() => props.onGraphic(`/editor/graphics/${name}.svg`, name)} className="rounded-md border border-zinc-200 p-3 hover:border-[#ed1b68]">
              <Image src={`/editor/graphics/${name}.svg`} alt={name} width={56} height={56} className="aspect-square w-full object-contain" />
              <span className="mt-1 block truncate text-[10px] capitalize">{name}</span>
            </button>
          ))}
        </div>
      </>}

      {props.active === 'background' && <>
        <PanelTitle>Background</PanelTitle>
        <div className="grid grid-cols-4 gap-3">
          {colors.map((color) => <button key={color} type="button" aria-label={`Set background ${color}`} onClick={() => props.onBackground(color)} className="aspect-square rounded-md border border-zinc-300 shadow-sm" style={{ background: color }} />)}
        </div>
      </>}

      {props.active === 'layers' && <>
        <PanelTitle>Layers</PanelTitle>
        <div className="space-y-2">
          {[...props.objects].reverse().map((object, reverseIndex) => (
            <div key={object.id ?? reverseIndex} className={`rounded-md border p-2 ${props.selected === object ? 'border-[#ed1b68] bg-pink-50' : 'border-zinc-200'}`}>
              <button type="button" onClick={() => props.onSelectLayer(object)} className="block w-full truncate text-left text-xs font-semibold">{object.name || object.type || 'Object'}</button>
              <div className="mt-2 flex gap-1">
                <button title="Bring forward" onClick={() => props.onLayerAction(object, 'forward')}><ChevronUp className="h-4 w-4" /></button>
                <button title="Send backward" onClick={() => props.onLayerAction(object, 'backward')}><ChevronDown className="h-4 w-4" /></button>
                <button title="Toggle visibility" onClick={() => props.onLayerAction(object, 'visible')}>{object.visible === false ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                <button title="Lock or unlock" onClick={() => props.onLayerAction(object, 'lock')}>{object.locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}</button>
                <button title="Delete" onClick={() => props.onLayerAction(object, 'delete')}><Trash2 className="h-4 w-4 text-red-500" /></button>
              </div>
            </div>
          ))}
        </div>
      </>}

      {props.selected && <div className="mt-6 border-t border-zinc-200 pt-4">
        <PanelTitle>Selected object</PanelTitle>
        {props.selected.type === 'textbox' || props.selected.type === 'i-text' || props.selected.type === 'text' ? (
          <div className="space-y-3">
            <select value={String(props.selected.fontFamily ?? 'Arial')} onChange={(e) => props.onChangeSelected({ fontFamily: e.target.value })} className="h-9 w-full rounded border px-2 text-sm">
              {['Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Verdana'].map((font) => <option key={font}>{font}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <Input aria-label="Font size" type="number" value={Number(props.selected.fontSize ?? 24)} onChange={(e) => props.onChangeSelected({ fontSize: Number(e.target.value) })} />
              <Input aria-label="Text color" type="color" value={String(props.selected.fill ?? '#231f20')} onChange={(e) => props.onChangeSelected({ fill: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-1">
              {['left', 'center', 'right'].map((align) => <Button key={align} size="sm" variant="outline" onClick={() => props.onChangeSelected({ textAlign: align })}>{align[0].toUpperCase()}</Button>)}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" variant="outline" onClick={() => props.onChangeSelected({ fontWeight: props.selected?.fontWeight === 'bold' ? 'normal' : 'bold' })}>Bold</Button>
              <Button size="sm" variant="outline" onClick={() => props.onChangeSelected({ fontStyle: props.selected?.fontStyle === 'italic' ? 'normal' : 'italic' })}>Italic</Button>
            </div>
            <label className="text-xs">Letter spacing<Input type="number" value={Number(props.selected.charSpacing ?? 0)} onChange={(e) => props.onChangeSelected({ charSpacing: Number(e.target.value) })} /></label>
          </div>
        ) : <div className="grid grid-cols-2 gap-2">
          <label className="text-xs">Fill<Input type="color" value={typeof props.selected.fill === 'string' ? props.selected.fill : '#ed1b68'} onChange={(e) => props.onChangeSelected({ fill: e.target.value })} /></label>
          <label className="text-xs">Border<Input type="color" value={typeof props.selected.stroke === 'string' ? props.selected.stroke : '#231f20'} onChange={(e) => props.onChangeSelected({ stroke: e.target.value })} /></label>
          <label className="text-xs">Border width<Input type="number" value={Number(props.selected.strokeWidth ?? 0)} onChange={(e) => props.onChangeSelected({ strokeWidth: Number(e.target.value) })} /></label>
          <label className="text-xs">Rotation<Input type="number" value={Math.round(props.selected.angle ?? 0)} onChange={(e) => props.onChangeSelected({ angle: Number(e.target.value) })} /></label>
        </div>}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button size="sm" type="button" variant="outline" onClick={() => props.onChangeSelected({ flipX: !props.selected?.flipX })}>Mirror horizontal</Button>
          <Button size="sm" type="button" variant="outline" onClick={() => props.onChangeSelected({ flipY: !props.selected?.flipY })}>Mirror vertical</Button>
          <Button size="sm" variant="outline" onClick={props.onDuplicate}><Copy /> Duplicate</Button>
          <Button size="sm" variant="outline" className="text-red-600" onClick={props.onDelete}><Trash2 /> Delete</Button>
        </div>
      </div>}
    </aside>
  )
}
