export const CHAT_ACTIONS = [
  { action: 'products', label: 'Products' },
  { action: 'custom_quote', label: 'Custom quote' },
  { action: 'artwork', label: 'Artwork' },
  { action: 'delivery', label: 'Delivery' },
  { action: 'track_order', label: 'Track order' },
  { action: 'human_support', label: 'Talk to our team' },
  { action: 'privacy', label: 'Policies & privacy' },
] as const
export type SupportIntent = typeof CHAT_ACTIONS[number]['action'] | 'payment' | 'complaint' | 'urgent' | 'unknown'
export interface ChatReply { intent: SupportIntent; response: string; requiresHuman: boolean; collectOrderId: boolean; notifyTeam: boolean }
const responses: Record<SupportIntent, string> = {
  products: 'We offer vinyl and mesh banners, feather and teardrop flags, plus custom signage such as shop-front signs, A-frames, grass stakes, table cloths and printed marketing materials. Browse /products for current options.',
  artwork: 'Accepted artwork formats: PDF, SVG, EPS, AI and PNG. Maximum file size: 100 MB. Use /contact to send artwork with a custom quote.',
  delivery: 'We deliver Australia wide. Production time depends on the product and quantity. Our team can confirm timing for your order.',
  privacy: 'Our policies: /policies, /privacy-policy, /terms-of-service, /refund-returns-policy and /warranty-disclaimer.',
  custom_quote: 'Please provide your product, size, quantity, deadline and artwork through /contact. Select Custom quote to submit the details to our team.',
  track_order: 'Please enter your order ID. Sign in with the verified email used for the order to view its status.',
  human_support: 'Tell us how we can help. Sign in to send your request here, or use /contact.',
  payment: 'Please describe the payment issue. Do not send card details. Sign in to send your request here, or use /contact.',
  complaint: 'Please describe what happened so our team can help. Sign in to send your request here, or use /contact.',
  urgent: 'Please describe your urgent request and deadline. Sign in to send it here, or use /contact.',
  unknown: 'Please choose a support button, or select Talk to our team for help.',
}
const patterns: [SupportIntent, RegExp][] = [
  ['payment', /\b(payment|charged|billing|refund)\b/i],
  ['complaint', /\b(complaint|complain|damaged|unhappy)\b/i],
  ['urgent', /\b(urgent|urgently|asap)\b/i],
  ['human_support', /\b(human|agent|person|support team)\b/i],
  ['custom_quote', /\b(quote|quotation)\b/i],
  ['track_order', /\b(track|tracking|order status)\b/i],
  ['privacy', /\b(privacy|policies|policy|terms)\b/i],
  ['artwork', /\b(artwork|pdf|svg|eps|png|file format)\b/i],
  ['delivery', /\b(delivery|shipping|production time)\b/i],
  ['products', /\b(products?|signage|banners?|flags?)\b/i],
]
const teamIntents = new Set<SupportIntent>(['custom_quote', 'payment', 'complaint', 'urgent', 'human_support'])
const emailIntents = new Set<SupportIntent>(['custom_quote', 'payment', 'human_support'])
export function supportIntent(action?: string, message = '', category = ''): SupportIntent {
  if (action && Object.hasOwn(responses, action)) return action as SupportIntent
  const categories: Record<string, SupportIntent> = { 'Custom quote': 'custom_quote', 'Payment issue': 'payment', 'Order status': 'track_order', 'Human request': 'human_support', 'Complaint': 'complaint', 'Urgent request': 'urgent' }
  return categories[category] || patterns.find(([, pattern]) => pattern.test(message))?.[0] || 'unknown'
}
export function notificationPolicy(intent: SupportIntent) {
  return { notifyTeam: teamIntents.has(intent), customerEmail: emailIntents.has(intent) }
}
export function ruleReply(intent: SupportIntent): ChatReply {
  return { intent, response: responses[intent], requiresHuman: teamIntents.has(intent), collectOrderId: intent === 'track_order', notifyTeam: teamIntents.has(intent) }
}
