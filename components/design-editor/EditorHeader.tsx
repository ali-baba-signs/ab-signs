'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Download, Eye, Redo2, Save, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  canUndo: boolean
  canRedo: boolean
  status: string
  onUndo: () => void
  onRedo: () => void
  onSave: () => void
  onPreview: () => void
  onDownload: () => void
  onContinue: () => void
}

export function EditorHeader(props: Props) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-zinc-200 bg-white px-4">
      <Link href="/" className="mr-2 flex items-center border-r border-zinc-200 pr-4">
        <Image src="/blogo.png" width={150} height={50} alt="Alibaba Signs" className="h-9 w-auto" />
      </Link>
      <Button variant="ghost" size="sm" onClick={props.onUndo} disabled={!props.canUndo}><Undo2 /> Undo</Button>
      <Button variant="ghost" size="sm" onClick={props.onRedo} disabled={!props.canRedo}><Redo2 /> Redo</Button>
      <span className="ml-auto hidden text-xs text-zinc-500 sm:block">{props.status}</span>
      <Button variant="outline" size="sm" onClick={props.onSave}><Save /> Save</Button>
      <Button variant="outline" size="sm" onClick={props.onPreview}><Eye /> Preview</Button>
      <Button variant="outline" size="sm" onClick={props.onDownload}><Download /> PNG</Button>
      <Button size="sm" onClick={props.onContinue} className="bg-[#ed1b68] hover:bg-[#c91556]">Continue</Button>
    </header>
  )
}
