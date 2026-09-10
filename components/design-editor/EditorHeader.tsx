'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Download, Redo2, Save, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  canUndo: boolean
  canRedo: boolean
  status: string
  onUndo: () => void
  onRedo: () => void
  onSave: () => void
  onPreview: () => void
  onDownloadPdf: () => void
  onDownloadSvg: () => void
  onContinue: () => void
  disabled?: boolean
}

export function EditorHeader(props: Props) {
  return (
    <header className="flex min-h-16 shrink-0 flex-wrap items-center gap-2 border-b border-zinc-200 bg-white px-3 py-3 lg:flex-nowrap lg:gap-3 lg:px-4">
      <Link href="/" className="mr-2 hidden items-center border-r border-zinc-200 pr-4 lg:flex">
        <Image src="/blogo.png" width={150} height={50} alt="Alibaba Signs" className="h-9 w-auto" />
      </Link>
      <Button variant="ghost" size="sm" onClick={props.onUndo} disabled={props.disabled || !props.canUndo}><Undo2 /> Undo</Button>
      <Button variant="ghost" size="sm" onClick={props.onRedo} disabled={props.disabled || !props.canRedo}><Redo2 /> Redo</Button>
      <span role="status" className="order-last w-full break-words text-xs text-zinc-500 lg:order-none lg:ml-auto lg:w-auto lg:min-w-0 lg:flex-1">{props.status}</span>
      <Button variant="outline" size="sm" onClick={props.onSave} disabled={props.disabled}><Save /> Save</Button>
      {/* <Button variant="outline" size="sm" onClick={props.onPreview} disabled={props.disabled}><Eye /> Preview</Button> */}
      <Button variant="outline" size="sm" onClick={props.onDownloadPdf} disabled={props.disabled}><Download /> PDF</Button>
      <Button variant="outline" size="sm" onClick={props.onDownloadSvg} disabled={props.disabled}><Download /> SVG</Button>
      <Button size="sm" onClick={props.onContinue} disabled={props.disabled} className="bg-[#ed1b68] hover:bg-[#c91556]">Continue</Button>
    </header>
  )
}
