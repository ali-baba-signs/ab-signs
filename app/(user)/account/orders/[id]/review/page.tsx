'use client'

import { Suspense, useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Star, ArrowLeft, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

const RATING_FIELDS = [
  { key: 'overall', label: 'Overall Experience', description: 'Your overall rating of the order' },
  { key: 'productQuality', label: 'Product Quality', description: 'Material durability and build' },
  { key: 'printQuality', label: 'Print Quality', description: 'Resolution, sharpness, and clarity' },
  { key: 'colourFinishQuality', label: 'Colour & Finish', description: 'Accuracy of colors and coating' },
  { key: 'timeliness', label: 'Timeliness', description: 'Delivery speed and turnaround' },
  { key: 'service', label: 'Customer Service', description: 'Communication and support' },
] as const

type RatingKey = (typeof RATING_FIELDS)[number]['key']

function InteractiveStarRating({
  value,
  onChange,
}: {
  value: number
  onChange: (val: number) => void
}) {
  const [hover, setHover] = useState<number | null>(null)

  return (
    <div className="flex items-center gap-1.5" role="radiogroup">
      {[1, 2, 3, 4, 5].map((star) => {
        const isFilled = star <= (hover ?? value)
        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={star === value}
            aria-label={`${star} star${star !== 1 ? 's' : ''}`}
            className="rounded p-1 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(null)}
            onClick={() => onChange(star)}
          >
            <Star
              className={`h-6 w-6 transition-colors ${
                isFilled
                  ? 'fill-amber-400 text-amber-400'
                  : 'fill-zinc-100 text-zinc-300 dark:fill-zinc-800 dark:text-zinc-600'
              }`}
            />
          </button>
        )
      })}
      <span className="ml-2 text-xs font-semibold text-muted-foreground">
        {(hover ?? value)} / 5
      </span>
    </div>
  )
}

function ReviewForm() {
  const params = useParams<{ id: string }>()
  const query = useSearchParams()
  const router = useRouter()
  const itemId = query.get('itemId') || ''

  const [ratings, setRatings] = useState<Record<RatingKey, number>>({
    overall: 5,
    productQuality: 5,
    printQuality: 5,
    colourFinishQuality: 5,
    timeliness: 5,
    service: 5,
  })

  const [feedback, setFeedback] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!itemId) {
      setErrorMessage('Order item identifier missing.')
      return
    }

    setSubmitting(true)
    setErrorMessage('')

    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderItemId: itemId,
          ...ratings,
          feedback: feedback.trim() || null,
        }),
      })

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error?.message || 'Failed to submit review.')
      }

      setIsSuccess(true)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Review submission failed.')
    } finally {
      setSubmitting(false)
    }
  }

  if (isSuccess) {
    return (
      <main className="min-h-[70vh] px-4 py-10">
        <div className="mx-auto max-w-xl rounded-xl border bg-card p-8 text-center shadow-sm">
          <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
          <h1 className="mt-4 text-2xl font-black">Thank You!</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your verified review has been submitted and sent for moderation.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href={`/account/orders/${params.id}`}>
              <Button>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Order
              </Button>
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-[70vh] px-4 py-10">
      <div className="mx-auto max-w-xl rounded-xl border bg-card p-6 shadow-sm sm:p-8">
        <div className="border-b pb-4">
          <Link
            href={`/account/orders/${params.id}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground mb-3"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to order
          </Link>
          <h1 className="text-2xl font-black">Review Your Order</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your feedback helps us maintain verified print and material standards.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {RATING_FIELDS.map(({ key, label, description }) => (
            <div
              key={key}
              className={`rounded-lg border p-4 transition-colors ${
                key === 'overall' ? 'border-amber-200 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/20' : 'bg-background'
              }`}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold">{label}</p>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
                <InteractiveStarRating
                  value={ratings[key]}
                  onChange={(val) => setRatings((prev) => ({ ...prev, [key]: val }))}
                />
              </div>
            </div>
          ))}

          <div className="space-y-2 pt-2">
            <label htmlFor="feedback" className="block text-sm font-semibold">
              Detailed Comments <span className="text-xs font-normal text-muted-foreground">(Optional)</span>
            </label>
            <textarea
              id="feedback"
              className="min-h-28 w-full rounded-md border bg-background p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              placeholder="Tell us what you liked about the finish, packaging, or customer service..."
              maxLength={5000}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
            />
            <p className="text-right text-xs text-muted-foreground">
              {feedback.length} / 5000 characters
            </p>
          </div>

          {errorMessage && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="flex flex-col gap-3 pt-4 sm:flex-row-reverse sm:justify-between">
            <Button
              type="submit"
              disabled={submitting || !itemId}
              className="w-full sm:w-auto"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting…
                </>
              ) : (
                <>
                  <Star className="mr-2 h-4 w-4 fill-primary-foreground" /> Submit Review
                </>
              )}
            </Button>
            <Link href={`/account/orders/${params.id}`} className="w-full sm:w-auto">
              <Button variant="outline" type="button" className="w-full">
                Cancel
              </Button>
            </Link>
          </div>
        </form>
      </div>
    </main>
  )
}

export default function ReviewPage() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-[70vh] place-items-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      }
    >
      <ReviewForm />
    </Suspense>
  )
}