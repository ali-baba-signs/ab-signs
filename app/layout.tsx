import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { ChatWidget } from '@/components/live-chat/chat-widget'
import { MetaPixel } from '@/components/analytics/meta-pixel'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://alibabasigns.com.au'),
  verification: {
    google: 'Yrth9xhu-wwVAxwhe0_i6cAlKDD5-BdaZ1nX0NTqEOA',
  },

  title: 'Alibaba Signs - Custom Banners & Vinyl Design',
  description: 'Custom signage, vinyl banners, mesh banners and online artwork tools for Australian businesses.',
  keywords: 'custom banners, vinyl banners, mesh banners, sign printing, design editor',
  icons: {
    icon: [
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/favicon.png',
  },
  openGraph: {
    title: 'Alibaba Signs - Custom Banners & Vinyl Design',
    description: 'Create custom signage with our interactive design editor. Professional quality printing.',
    type: 'website',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFFFFF' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="scroll-smooth light">
      <head>
        {/* Google Tag (gtag.js) */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=AW-18522055990"
          strategy="afterInteractive"
        />
        <Script id="google-gtag" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());

            gtag('config', 'AW-18522055990');
          `}
        </Script>
      </head>
      <body className="antialiased bg-white text-slate-900">
        {children}
        <ChatWidget />
        <MetaPixel />
        {process.env.VERCEL === '1' && <Analytics />}
      </body>
    </html>
  )
}