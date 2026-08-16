import { AtSign, Globe2, MessageCircle, Music2 } from 'lucide-react'

export function SocialIcon({ platform, className = 'h-5 w-5' }: { platform: string; className?: string }) {
  if (platform === 'whatsapp') return <MessageCircle className={className} aria-hidden="true" />
  if (platform === 'tiktok') return <Music2 className={className} aria-hidden="true" />
  if (platform === 'other') return <Globe2 className={className} aria-hidden="true" />
  if (platform === 'x') return <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true"><path d="M18.9 2H22l-6.8 7.8L23.2 22H17l-4.9-6.4L6.5 22H3.4l7.2-8.2L.8 2h6.4l4.4 5.8L18.9 2Zm-1.1 17.8h1.7L6.3 4.1H4.5l13.3 15.7Z" /></svg>
  const paths: Record<string, string> = {
    facebook: 'M13.5 22v-9h3l.5-3.5h-3.5V7.3c0-1 .3-1.7 1.8-1.7H17V2.4c-.8-.1-1.7-.2-2.5-.2-2.5 0-4.2 1.5-4.2 4.4v2.9H7.5V13h2.8v9h3.2Z',
    instagram: 'M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7Zm10.5 1.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
    linkedin: 'M5.3 7.7H2V22h3.3V7.7ZM3.7 2A1.9 1.9 0 1 0 3.7 5.8 1.9 1.9 0 0 0 3.7 2ZM22 13.8c0-4.3-2.3-6.3-5.4-6.3-2.5 0-3.6 1.4-4.2 2.3V7.7H9.1V22h3.3v-7.1c0-1.9.4-3.8 2.8-3.8 2.3 0 2.4 2.2 2.4 3.9v7H22v-8.2Z',
    youtube: 'M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.3 3.6-6.3 3.6Z',
  }
  const path = paths[platform]
  return path ? <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true"><path d={path} /></svg> : <AtSign className={className} aria-hidden="true" />
}
