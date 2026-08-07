'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { adminPath } from '@/lib/auth/admin-path'

interface Review { id: string; productName: string; customerName: string; orderNumber: string; overall: number; productQuality: number; printQuality: number; timeliness: number; service: number; feedback: string | null; moderationStatus: string; createdAt: string }

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [error, setError] = useState('')
  async function load() { const response = await fetch('/api/admin/reviews', { cache: 'no-store' }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error?.message || 'Reviews could not be loaded.'); setReviews(payload.data.reviews) }
  useEffect(() => { const timer = window.setTimeout(() => void load().catch((caught) => setError(caught.message)), 0); return () => window.clearTimeout(timer) }, [])
  async function moderate(id: string, status: string) { const response = await fetch(`/api/admin/reviews/${id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status }) }); const payload = await response.json(); if (!response.ok) return setError(payload.error?.message || 'Review moderation failed.'); await load() }
  return <main className="min-h-screen bg-background px-4 py-8"><div className="mx-auto max-w-6xl"><Link href={adminPath()} className="inline-flex gap-2"><ArrowLeft /> Dashboard</Link><h1 className="mt-2 text-3xl font-black">Verified order reviews</h1>{error && <p className="mt-4 rounded bg-red-50 p-3 text-red-700">{error}</p>}<div className="mt-6 space-y-4">{!reviews.length ? <p className="rounded-xl border bg-card p-10 text-center text-muted-foreground">No customer reviews yet.</p> : reviews.map((review) => <article key={review.id} className="rounded-xl border bg-card p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-bold">{review.productName}</h2><p className="text-sm text-muted-foreground">{review.customerName} · {review.orderNumber} · verified purchase</p></div><p className="flex items-center gap-1 font-bold"><Star className="h-4 w-4 fill-amber-400 text-amber-400" /> {review.overall}/5</p></div><p className="mt-3 text-sm">Product {review.productQuality}/5 · Print {review.printQuality}/5 · Timeliness {review.timeliness}/5 · Service {review.service}/5</p>{review.feedback && <p className="mt-3 rounded bg-secondary p-3">{review.feedback}</p>}<div className="mt-4 flex flex-wrap gap-2">{['pending', 'published', 'hidden'].map((status) => <Button key={status} size="sm" variant={review.moderationStatus === status ? 'default' : 'outline'} onClick={() => void moderate(review.id, status)}>{status}</Button>)}</div></article>)}</div></div></main>
}
