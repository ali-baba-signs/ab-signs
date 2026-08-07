'use client'

import { Eye, EyeOff, Maximize } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ProductConfig } from '@/lib/editor/types'

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
  return <section className="relative min-w-0 flex-1 bg-zinc-100">
    <div className="absolute left-3 top-3 z-10 flex gap-2 rounded-md border border-zinc-200 bg-white p-1 shadow-sm"><Button size="sm" variant="ghost" onClick={onFit}><Maximize /> Fit</Button><Button size="sm" variant="ghost" onClick={onToggleGuides}>{guides ? <Eye /> : <EyeOff />} Guides</Button><span className="self-center px-2 text-xs text-zinc-500">{Math.round(zoom * 100)}%</span></div>
    <div ref={workspaceRef} className="flex h-full w-full items-center justify-center overflow-auto p-20"><div className="relative bg-white shadow-[0_15px_45px_rgba(0,0,0,.2)]"><Rulers config={productConfig} zoom={zoom} /><canvas ref={canvasRef} /></div></div>
  </section>
}
