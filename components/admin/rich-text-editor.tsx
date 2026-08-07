'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AlignCenter, AlignLeft, AlignRight, Bold, Italic, Link2, List, ListOrdered, Redo2, RemoveFormatting, Underline, Undo2 } from 'lucide-react'

const controls = [
  { command: 'bold', label: 'Bold', icon: Bold },
  { command: 'italic', label: 'Italic', icon: Italic },
  { command: 'underline', label: 'Underline', icon: Underline },
  { command: 'insertUnorderedList', label: 'Bulleted list', icon: List },
  { command: 'insertOrderedList', label: 'Numbered list', icon: ListOrdered },
  { command: 'justifyLeft', label: 'Align left', icon: AlignLeft },
  { command: 'justifyCenter', label: 'Align center', icon: AlignCenter },
  { command: 'justifyRight', label: 'Align right', icon: AlignRight },
  { command: 'undo', label: 'Undo', icon: Undo2 },
  { command: 'redo', label: 'Redo', icon: Redo2 },
] as const

function validLink(value: string) {
  if (value.startsWith('/') && !value.startsWith('//')) return value
  try {
    const parsed = new URL(value)
    return ['http:', 'https:', 'mailto:'].includes(parsed.protocol) ? parsed.toString() : null
  } catch { return null }
}

export function RichTextEditor({ value, onChange, error }: { value: string; onChange: (value: string) => void; error?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState<Set<string>>(new Set())

  const updateActive = useCallback(() => {
    if (!ref.current || !ref.current.contains(document.activeElement)) return
    setActive(new Set(controls.filter(({ command }) => {
      try { return document.queryCommandState(command) }
      catch { return false }
    }).map(({ command }) => command)))
  }, [])

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value
  }, [value])

  useEffect(() => {
    document.addEventListener('selectionchange', updateActive)
    return () => document.removeEventListener('selectionchange', updateActive)
  }, [updateActive])

  function run(command: string, argument?: string) {
    ref.current?.focus()
    document.execCommand(command, false, argument)
    onChange(ref.current?.innerHTML || '')
    updateActive()
  }

  function createLink() {
    const input = window.prompt('Enter an internal path, HTTPS URL, or mailto link')
    if (!input) return
    const href = validLink(input.trim())
    if (!href) return window.alert('Use /path, https://, http://, or mailto:.')
    run('createLink', href)
  }

  const toolButton = 'grid h-9 w-9 place-items-center rounded border transition hover:bg-background focus-visible:outline-2 focus-visible:outline-primary'
  return <div>
    <div className="flex flex-wrap gap-1 rounded-t-md border border-b-0 bg-secondary p-2" role="toolbar" aria-label="Description formatting">
      {controls.map(({ command, label, icon: Icon }) => <button key={command} type="button" title={label} aria-label={label} aria-pressed={active.has(command)} onMouseDown={(event) => event.preventDefault()} onClick={() => run(command)} className={`${toolButton} ${active.has(command) ? 'border-primary bg-primary/10 text-primary' : 'bg-card'}`}><Icon className="h-4 w-4" /></button>)}
      <button type="button" title="Insert link" aria-label="Insert link" onMouseDown={(event) => event.preventDefault()} onClick={createLink} className={`${toolButton} bg-card`}><Link2 className="h-4 w-4" /></button>
      <button type="button" title="Clear formatting" aria-label="Clear formatting" onMouseDown={(event) => event.preventDefault()} onClick={() => run('removeFormat')} className={`${toolButton} bg-card`}><RemoveFormatting className="h-4 w-4" /></button>
    </div>
    <div ref={ref} contentEditable role="textbox" aria-multiline="true" aria-label="Product description" onInput={(event) => onChange(event.currentTarget.innerHTML)} onKeyUp={updateActive} onMouseUp={updateActive} className={`min-h-40 rounded-b-md border bg-background p-3 focus:outline-none focus:ring-2 focus:ring-primary ${error ? 'border-red-500' : ''}`} suppressContentEditableWarning />
    {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
  </div>
}
