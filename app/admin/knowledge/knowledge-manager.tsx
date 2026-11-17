'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, BookOpen, Eye, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { adminPath } from '@/lib/auth/admin-path'

type Status = 'pending' | 'approved' | 'rejected'
type Entry = { id: string; intent: string; title: string | null; category: string | null; content: string | null; approvedAnswer: string; keywords: string[]; sourceDocument: string | null; sourceVersion: string | null; approvalStatus: Status; enabled: boolean; approvedBy: string | null; approvedAt: string | null; updatedAt: string }
type Form = Pick<Entry, 'intent' | 'title' | 'category' | 'content' | 'approvedAnswer' | 'keywords' | 'sourceDocument' | 'sourceVersion' | 'approvalStatus' | 'enabled'>
const empty: Form = { intent: '', title: '', category: '', content: '', approvedAnswer: '', keywords: [], sourceDocument: '', sourceVersion: '', approvalStatus: 'pending', enabled: false }
const fieldClass = 'mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm'

export default function KnowledgeManager() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')
  const [enabled, setEnabled] = useState('')
  const [sort, setSort] = useState('newest')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'list' | 'view' | 'edit' | 'add'>('list')
  const [selected, setSelected] = useState<Entry | null>(null)
  const [form, setForm] = useState<Form>(empty)
  const [keyword, setKeyword] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), sort })
      if (query) params.set('search', query)
      if (category) params.set('category', category)
      if (status) params.set('status', status)
      if (enabled) params.set('enabled', enabled)
      const response = await fetch(`/api/admin/knowledge?${params}`, { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error?.message || 'Knowledge entries could not be loaded.')
      setEntries(payload.data.entries); setTotal(payload.data.total); setCategories(payload.data.categories); setError('')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Knowledge entries could not be loaded.') }
    finally { setLoading(false) }
  }, [page, query, category, status, enabled, sort])
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer) }, [load])
  useEffect(() => { const timer = window.setTimeout(() => { setPage(1); setQuery(search.trim()) }, 350); return () => window.clearTimeout(timer) }, [search])
  const resetFilter = (setter: (value: string) => void, value: string) => { setPage(1); setter(value) }
  const open = (entry: Entry, next: 'view' | 'edit') => { setSelected(entry); setForm({ intent: entry.intent, title: entry.title || '', category: entry.category || '', content: entry.content || '', approvedAnswer: entry.approvedAnswer, keywords: entry.keywords, sourceDocument: entry.sourceDocument || '', sourceVersion: entry.sourceVersion || '', approvalStatus: entry.approvalStatus, enabled: entry.enabled }); setMode(next); setError(''); setNotice('') }
  async function mutate(url: string, method: string, body?: object) {
    const response = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error?.message || 'The operation failed.')
    return payload.data
  }
  async function save(event: React.FormEvent) {
    event.preventDefault(); setError(''); setNotice('')
    if (!form.intent.trim() || !form.approvedAnswer.trim()) return setError('Intent and approved answer are required.')
    if (form.approvedAnswer.length > 1200) return setError('Approved answer cannot exceed 1200 characters.')
    if (form.enabled && form.approvalStatus !== 'approved') return setError('Only approved entries can be enabled.')
    setSaving(true)
    try {
      const url = mode === 'add' ? '/api/admin/knowledge' : `/api/admin/knowledge/${encodeURIComponent(selected!.id)}`
      await mutate(url, mode === 'add' ? 'POST' : 'PATCH', form)
      setMode('list'); setSelected(null); setNotice(mode === 'add' ? 'Knowledge entry created.' : 'Knowledge entry updated.'); await load()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Save failed.') }
    finally { setSaving(false) }
  }
  async function toggle(entry: Entry) {
    if (!window.confirm(`${entry.enabled ? 'Disable' : 'Enable'} “${entry.title || entry.intent}”?`)) return
    setError(''); setNotice('')
    try { await mutate(`/api/admin/knowledge/${encodeURIComponent(entry.id)}`, 'PATCH', { enabled: !entry.enabled }); setNotice(entry.enabled ? 'Entry disabled.' : 'Entry enabled.'); await load() }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Status change failed.') }
  }
  async function remove(entry: Entry) {
    if (!window.confirm(`Permanently delete “${entry.title || entry.intent}”? This cannot be undone.`)) return
    setError(''); setNotice('')
    try { await mutate(`/api/admin/knowledge/${encodeURIComponent(entry.id)}`, 'DELETE'); setNotice('Entry deleted.'); if (entries.length === 1 && page > 1) setPage(page - 1); else await load() }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Delete failed.') }
  }
  function addKeyword() { const value = keyword.trim(); if (value && !form.keywords.includes(value) && form.keywords.length < 50) setForm({ ...form, keywords: [...form.keywords, value] }); setKeyword('') }
  const badge = (value: string) => <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${value === 'approved' || value === 'Enabled' ? 'bg-emerald-100 text-emerald-800' : value === 'rejected' || value === 'Disabled' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>{value.charAt(0).toUpperCase() + value.slice(1)}</span>

  return <main className="min-h-screen bg-slate-50 px-4 py-8 dark:bg-background"><div className="mx-auto max-w-7xl">
    <Link href={adminPath()} className="inline-flex items-center gap-2 text-sm font-semibold"><ArrowLeft className="h-4 w-4" /> Dashboard</Link>
    <div className="mt-4 flex flex-wrap items-end justify-between gap-4"><div><h1 className="flex items-center gap-3 text-3xl font-black"><BookOpen className="text-primary" /> Knowledge Base</h1><p className="mt-1 text-sm text-muted-foreground">Review, approve, and manage knowledge entries.</p></div>{mode === 'list' && <Button onClick={() => { setForm(empty); setSelected(null); setMode('add'); setError(''); setNotice('') }}><Plus className="h-4 w-4" /> Add Knowledge Entry</Button>}</div>
    {notice && <p role="status" className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    {error && <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {mode === 'list' ? <section className="mt-6 overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="grid gap-3 border-b p-4 sm:grid-cols-2 lg:grid-cols-5"><label className="text-sm">Search<Input className="mt-1" placeholder="Title, intent, content, keywords" value={search} onChange={(event) => setSearch(event.target.value)} /></label><label className="text-sm">Category<select className={fieldClass} value={category} onChange={(event) => resetFilter(setCategory, event.target.value)}><option value="">All categories</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></label><label className="text-sm">Approval<select className={fieldClass} value={status} onChange={(event) => resetFilter(setStatus, event.target.value)}><option value="">All statuses</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></label><label className="text-sm">Activation<select className={fieldClass} value={enabled} onChange={(event) => resetFilter(setEnabled, event.target.value)}><option value="">All entries</option><option value="true">Enabled</option><option value="false">Disabled</option></select></label><label className="text-sm">Last updated<select className={fieldClass} value={sort} onChange={(event) => resetFilter(setSort, event.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="bg-secondary"><tr>{['Title', 'Intent', 'Category', 'Approval Status', 'Enabled Status', 'Approved By', 'Last Updated', 'Actions'].map((label) => <th key={label} className="px-4 py-3 font-semibold">{label}</th>)}</tr></thead><tbody className="divide-y">{entries.map((entry) => <tr key={entry.id} className="hover:bg-muted/30"><td className="max-w-52 truncate px-4 py-3 font-semibold" title={entry.title || ''}>{entry.title || 'Untitled'}</td><td className="max-w-44 truncate px-4 py-3">{entry.intent}</td><td className="px-4 py-3">{entry.category || '—'}</td><td className="px-4 py-3">{badge(entry.approvalStatus)}</td><td className="px-4 py-3">{badge(entry.enabled ? 'Enabled' : 'Disabled')}</td><td className="max-w-32 truncate px-4 py-3" title={entry.approvedBy || ''}>{entry.approvedBy || '—'}</td><td className="px-4 py-3 whitespace-nowrap">{new Date(entry.updatedAt).toLocaleString()}</td><td className="px-4 py-3"><div className="flex gap-1"><Button size="sm" variant="outline" aria-label={`View ${entry.title || entry.intent}`} onClick={() => open(entry, 'view')}><Eye className="h-4 w-4" /></Button><Button size="sm" variant="outline" aria-label={`Edit ${entry.title || entry.intent}`} onClick={() => open(entry, 'edit')}><Pencil className="h-4 w-4" /></Button><Button size="sm" variant="outline" disabled={!entry.enabled && entry.approvalStatus !== 'approved'} onClick={() => void toggle(entry)}>{entry.enabled ? 'Disable' : 'Enable'}</Button><Button size="sm" variant="outline" className="text-red-700" aria-label={`Delete ${entry.title || entry.intent}`} onClick={() => void remove(entry)}><Trash2 className="h-4 w-4" /></Button></div></td></tr>)}</tbody></table></div>
      {loading ? <p className="p-10 text-center text-muted-foreground">Loading knowledge entries…</p> : entries.length === 0 ? <p className="p-10 text-center text-muted-foreground">No knowledge entries match these filters.</p> : null}
      <div className="flex items-center justify-between gap-3 border-t p-4 text-sm"><span>{total} entries · Page {page} of {Math.max(1, Math.ceil(total / 20))}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={page * 20 >= total || loading} onClick={() => setPage(page + 1)}>Next</Button></div></div>
    </section> : mode === 'view' && selected ? <section className="mt-6 rounded-xl border bg-card p-6 shadow-sm"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-xl font-bold">{selected.title || selected.intent}</h2><p className="text-xs text-muted-foreground">ID: {selected.id}</p></div><div className="flex gap-2"><Button variant="outline" onClick={() => setMode('list')}>Back to entries</Button><Button onClick={() => open(selected, 'edit')}>Edit entry</Button></div></div><dl className="mt-6 grid gap-5 sm:grid-cols-2">{([['Intent', selected.intent], ['Category', selected.category], ['Approval status', selected.approvalStatus], ['Enabled', selected.enabled ? 'Yes' : 'No'], ['Approved by', selected.approvedBy], ['Approved at', selected.approvedAt ? new Date(selected.approvedAt).toLocaleString() : null], ['Source document', selected.sourceDocument], ['Source version', selected.sourceVersion], ['Keywords', selected.keywords.join(', ')], ['Last updated', new Date(selected.updatedAt).toLocaleString()], ['Content', selected.content], ['Approved answer', selected.approvedAnswer]] as [string, string | null][]).map(([label, value]) => <div key={label}><dt className="text-xs font-bold uppercase text-muted-foreground">{label}</dt><dd className="mt-1 whitespace-pre-wrap text-sm">{value || '—'}</dd></div>)}</dl></section> : <form onSubmit={(event) => void save(event)} className="mt-6 rounded-xl border bg-card p-5 shadow-sm"><div className="flex justify-between gap-3"><div><h2 className="text-xl font-bold">{mode === 'add' ? 'Add Knowledge Entry' : 'Edit Knowledge Entry'}</h2><p className="text-xs text-muted-foreground">{selected ? `ID: ${selected.id}` : 'ID is generated automatically on save.'}</p></div><Button type="button" variant="outline" onClick={() => setMode('list')}>Cancel</Button></div><div className="mt-6 grid gap-5 md:grid-cols-2">
      <label className="text-sm font-semibold">Intent *<Input required className="mt-1" value={form.intent} onChange={(e) => setForm({ ...form, intent: e.target.value })} /></label><label className="text-sm font-semibold">Title<Input className="mt-1" value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label><label className="text-sm font-semibold">Category<Input list="knowledge-categories" className="mt-1" value={form.category || ''} onChange={(e) => setForm({ ...form, category: e.target.value })} /><datalist id="knowledge-categories">{categories.map((item) => <option key={item} value={item} />)}</datalist></label><label className="text-sm font-semibold">Approval status<select className={fieldClass} value={form.approvalStatus} onChange={(e) => { const next = e.target.value as Status; setForm({ ...form, approvalStatus: next, enabled: next === 'approved' ? form.enabled : false }) }}><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></label>
      <label className="text-sm font-semibold md:col-span-2">Content<textarea className={`${fieldClass} min-h-36`} value={form.content || ''} onChange={(e) => setForm({ ...form, content: e.target.value })} /></label><label className="text-sm font-semibold md:col-span-2">Approved answer *<textarea required maxLength={1200} className={`${fieldClass} min-h-36`} value={form.approvedAnswer} onChange={(e) => setForm({ ...form, approvedAnswer: e.target.value })} /><span className="mt-1 block text-right text-xs text-muted-foreground">{form.approvedAnswer.length}/1200 characters</span></label>
      <div className="md:col-span-2"><label htmlFor="keyword" className="text-sm font-semibold">Keywords</label><div className="mt-1 flex gap-2"><Input id="keyword" value={keyword} onChange={(e) => setKeyword(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addKeyword() } }} placeholder="Type a keyword and press Enter" /><Button type="button" variant="outline" onClick={addKeyword}>Add</Button></div><div className="mt-2 flex flex-wrap gap-2">{form.keywords.map((item) => <button key={item} type="button" className="rounded-full bg-secondary px-3 py-1 text-xs" onClick={() => setForm({ ...form, keywords: form.keywords.filter((word) => word !== item) })}>{item} ×</button>)}</div></div>
      <label className="text-sm font-semibold">Source document<Input className="mt-1" value={form.sourceDocument || ''} onChange={(e) => setForm({ ...form, sourceDocument: e.target.value })} /></label><label className="text-sm font-semibold">Source version<Input className="mt-1" value={form.sourceVersion || ''} onChange={(e) => setForm({ ...form, sourceVersion: e.target.value })} /></label><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.enabled} disabled={form.approvalStatus !== 'approved'} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} /> Enabled</label>
      </div><div className="mt-6 flex justify-end"><Button type="submit" disabled={saving}>{saving ? 'Saving…' : mode === 'add' ? 'Create entry' : 'Save changes'}</Button></div></form>}
  </div></main>
}
