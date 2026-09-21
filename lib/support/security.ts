import { createHash, timingSafeEqual } from 'node:crypto'
export function validSupportSecret(provided: string | null, expected: string | undefined) {
  if(!expected || expected.length<32 || !provided || provided.length>512)return false
  return timingSafeEqual(createHash('sha256').update(provided).digest(),createHash('sha256').update(expected).digest())
}
export function supportWebhookUrl(configured: string, env: Record<string,string|undefined> = process.env) {
  const url=new URL(env.SUPPORT_WEBHOOK_URL || configured || 'https://automation.alibabasigns.com.au/webhook/support-message')
  const allowed=(env.SUPPORT_WEBHOOK_ALLOWED_HOSTS || 'automation.alibabasigns.com.au').split(',').map(v=>v.trim().toLowerCase()).filter(Boolean)
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.port&&url.port!=='443'||!allowed.includes(url.hostname.toLowerCase()))throw new Error('Support webhook hostname is not allowed by the server configuration.')
  return url.toString()
}
