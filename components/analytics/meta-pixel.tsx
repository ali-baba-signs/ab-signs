'use client'

import Script from 'next/script'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID

export function trackMetaEvent(name: string, data?: Record<string, unknown>) {
  if (!pixelId || process.env.NODE_ENV !== 'production' || typeof window === 'undefined') return
  const fbq = (window as Window & { fbq?: (...args: unknown[]) => void }).fbq
  fbq?.('track', name, data)
}

function PageViews() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const url = `${pathname}?${searchParams.toString()}`
  useEffect(() => {
    if (!pixelId || process.env.NODE_ENV !== 'production') return
    // Strict Mode can replay effects; the URL still represents one navigation.
    if (window.__metaPixelLastPageView === url) return
    window.__metaPixelLastPageView = url
    trackMetaEvent('PageView')
  }, [url])
  return null
}

declare global {
  interface Window { __metaPixelLastPageView?: string }
}

export function MetaPixel() {
  const [ready, setReady] = useState(false)
  if (!pixelId || process.env.NODE_ENV !== 'production') return null
  return <>
    <Script id="meta-pixel" strategy="afterInteractive" onReady={() => setReady(true)}>{`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init',${JSON.stringify(pixelId)});`}</Script>
    {ready && <PageViews />}
  </>
}
