'use client'

import { Eye, EyeOff, Maximize } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ProductConfig } from '@/lib/editor/types'
import { productionSpec } from '@/lib/production/production-spec'
import { cropMarkPath } from '@/lib/production/print-settings'

const unitFactors = { mm: 1, cm: 10, in: 25.4, ft: 304.8, m: 1000 }

function Rulers({ config, zoom }: { config: ProductConfig; zoom: number }) {
  const unit = config.measurementUnit || 'mm'
  const width = config.widthMm / unitFactors[unit]
  const height = config.heightMm / unitFactors[unit]
  const divisions = 10
  return <>
    <div aria-label={`Horizontal ruler in ${unit}`} className="absolute bottom-full left-0 h-7 border-b border-zinc-400 bg-white text-[9px] text-zinc-600" style={{ width: config.logicalCanvasWidth * zoom }}>
      <span className="absolute -top-5 left-0 rounded bg-zinc-800 px-1.5 py-0.5 font-bold text-white">{unit}</span>
      {Array.from({ length: divisions + 1 }, (_, index) => <span key={index} className="absolute bottom-0 border-l border-zinc-500 pl-1" style={{ left: `${index / divisions * 100}%`, height: index % 5 === 0 ? 14 : 8 }}>{(width * index / divisions).toFixed(width < 10 ? 1 : 0)}</span>)}
    </div>
    <div aria-label={`Vertical ruler in ${unit}`} className="absolute right-full top-0 w-8 border-r border-zinc-400 bg-white text-[9px] text-zinc-600" style={{ height: config.logicalCanvasHeight * zoom }}>
      {Array.from({ length: divisions + 1 }, (_, index) => <span key={index} className="absolute right-0 border-t border-zinc-500 pt-0.5" style={{ top: `${index / divisions * 100}%`, width: index % 5 === 0 ? 26 : 10 }}><span className="absolute right-3 whitespace-nowrap">{(height * index / divisions).toFixed(height < 10 ? 1 : 0)}</span></span>)}
    </div>
  </>
}

export function CanvasWorkspace({ canvasRef, workspaceRef, guides, zoom, productConfig, onToggleGuides, onFit }: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>; workspaceRef: React.RefObject<HTMLDivElement | null>
  guides: boolean; zoom: number; productConfig: ProductConfig; onToggleGuides: () => void; onFit: () => void
}) {
  const spec = productionSpec(productConfig)
  const width = productConfig.logicalCanvasWidth * zoom, height = productConfig.logicalCanvasHeight * zoom
  const scaleX = width / spec.trimWidthMm, scaleY = height / spec.trimHeightMm
  const left = (spec.markMarginMm + spec.bleedMm) * scaleX, top = (spec.markMarginMm + spec.bleedMm) * scaleY
  const bleedX = spec.bleedMm * scaleX, bleedY = spec.bleedMm * scaleY
  const safeX = spec.safetyMm * scaleX, safeY = spec.safetyMm * scaleY
  return <section className="relative flex min-w-0 flex-1 bg-zinc-100">
    <div className="absolute left-3 top-3 z-10 rounded-md border border-zinc-200 bg-white p-1 shadow-sm"><div className="flex gap-2"><Button size="sm" variant="ghost" onClick={onFit}><Maximize /> Fit</Button><Button size="sm" variant="ghost" onClick={onToggleGuides}>{guides ? <Eye /> : <EyeOff />} Guides</Button><span className="self-center px-2 text-xs text-zinc-500">{Math.round(zoom * 100)}%</span></div>{guides && <div aria-label="Design guide key" className="flex flex-wrap gap-x-3 gap-y-1 border-t px-2 py-1.5 text-[11px]"><span title="Artwork should extend to this outer boundary." className="cursor-help whitespace-nowrap"><i className="mr-1 inline-block h-0 w-4 border-t border-dashed border-[#ed1b68] align-middle"/>Bleed</span><span title="This is the final finished cutting boundary." className="cursor-help whitespace-nowrap"><i className="mr-1 inline-block h-0 w-4 border-t border-black align-middle"/>Trim</span><span title="Keep important text and logos inside this line." className="cursor-help whitespace-nowrap"><i className="mr-1 inline-block h-0 w-4 border-t border-dashed border-green-500 align-middle"/>Safe area</span><span>Crop marks stay outside bleed. Guides are preview-only.</span></div>}</div>
    <div ref={workspaceRef} className="flex min-w-0 flex-1 items-center justify-center overflow-auto p-12 lg:p-20"><div className="relative shrink-0 bg-white shadow-[0_15px_45px_rgba(0,0,0,.2)]"><Rulers config={productConfig} zoom={zoom} /><canvas ref={canvasRef} />{guides && spec.productKind !== 'flag' && <svg className="pointer-events-none absolute z-10" style={{ left: -left, top: -top, width: width + left * 2, height: height + top * 2 }} viewBox={`0 0 ${width + left * 2} ${height + top * 2}`} aria-label="Bleed, trim, safe area, and crop mark guides">
      <rect x={left-bleedX} y={top-bleedY} width={width+bleedX*2} height={height+bleedY*2} fill="none" stroke="#db2777" strokeDasharray="5 4" strokeWidth="1" />
      <rect x={left} y={top} width={width} height={height} fill="none" stroke="#111827" strokeWidth="1" />
      <rect x={left+safeX} y={top+safeY} width={width-safeX*2} height={height-safeY*2} fill="none" stroke="#15803d" strokeDasharray="5 4" strokeWidth="1" />
      {spec.cropMarks && <path d={cropMarkPath(left, top, width, height, bleedX, bleedY, scaleX, scaleY)} fill="none" stroke="#111827" strokeWidth="1" />}
    </svg>}</div></div>
  </section>
}
