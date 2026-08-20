'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

export function CopyCouponButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() { await navigator.clipboard.writeText(code); setCopied(true); window.setTimeout(() => setCopied(false), 1800) }
  return <Button type="button" variant="outline" size="sm" onClick={() => void copy()}>{copied ? 'Copied' : 'Copy code'}</Button>
}
