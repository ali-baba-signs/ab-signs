'use client'

import {
  Boxes, ImageUp, Layers, LayoutTemplate, Package, Palette, Shapes, Type,
} from 'lucide-react'
import type { EditorSection } from '@/lib/editor/types'

const sections: Array<{ id: EditorSection; label: string; icon: typeof Package }> = [
  { id: 'product', label: 'Product', icon: Package },
  { id: 'templates', label: 'Templates', icon: LayoutTemplate },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'uploads', label: 'Uploads', icon: ImageUp },
  { id: 'graphics', label: 'Graphics', icon: Shapes },
  { id: 'background', label: 'Background', icon: Palette },
  { id: 'layers', label: 'Layers', icon: Layers },
]

export function EditorSidebar({ active, onChange }: { active: EditorSection; onChange: (value: EditorSection) => void }) {
  return (
    <nav className="flex w-[78px] shrink-0 flex-col border-r border-zinc-200 bg-white py-2">
      {sections.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={`flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium transition ${
            active === id ? 'border-r-2 border-[#ed1b68] bg-pink-50 text-[#ed1b68]' : 'text-zinc-600 hover:bg-zinc-50'
          }`}
        >
          <Icon className="h-5 w-5" />
          {label}
        </button>
      ))}
    </nav>
  )
}
