import 'server-only'

export type KnowledgeInput = {
  intent: string; title: string | null; category: string | null; content: string | null;
  approvedAnswer: string; keywords: string[]; sourceDocument: string | null;
  sourceVersion: string | null; approvalStatus: 'pending' | 'approved' | 'rejected'; enabled: boolean
}

export class KnowledgeValidationError extends Error {}

export function validateKnowledgeInput(value: unknown, partial = false): Partial<KnowledgeInput> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new KnowledgeValidationError('A knowledge entry is required.')
  const raw = value as Record<string, unknown>
  const allowed = ['intent', 'title', 'category', 'content', 'approvedAnswer', 'keywords', 'sourceDocument', 'sourceVersion', 'approvalStatus', 'enabled'] as const
  if (Object.keys(raw).some((key) => !allowed.includes(key as typeof allowed[number]))) throw new KnowledgeValidationError('Unknown knowledge entry field.')
  const result: Record<string, unknown> = {}
  for (const key of ['intent', 'approvedAnswer', 'title', 'category', 'content', 'sourceDocument', 'sourceVersion'] as const) {
    if (!(key in raw)) continue
    const input = raw[key]
    if (typeof input !== 'string' && input !== null) throw new KnowledgeValidationError(`${key} must be text.`)
    const cleaned = typeof input === 'string' ? input.trim() : null
    result[key] = key === 'intent' || key === 'approvedAnswer' ? cleaned ?? '' : cleaned || null
    if ((key === 'intent' || key === 'approvedAnswer') && !cleaned) throw new KnowledgeValidationError(`${key} is required.`)
    if (typeof cleaned === 'string' && cleaned.length > (key === 'approvedAnswer' ? 1200 : key === 'content' ? 50000 : 500)) throw new KnowledgeValidationError(`${key} is too long.`)
  }
  if ('keywords' in raw) {
    if (!Array.isArray(raw.keywords) || raw.keywords.length > 50 || raw.keywords.some((word) => typeof word !== 'string' || !word.trim() || word.length > 100)) throw new KnowledgeValidationError('Keywords must be a list of up to 50 nonempty terms (100 characters each).')
    result.keywords = [...new Set(raw.keywords.map((word: string) => word.trim()))]
  }
  if ('approvalStatus' in raw) {
    if (!['pending', 'approved', 'rejected'].includes(raw.approvalStatus as string)) throw new KnowledgeValidationError('Choose a valid approval status.')
    result.approvalStatus = raw.approvalStatus
  }
  if ('enabled' in raw) {
    if (typeof raw.enabled !== 'boolean') throw new KnowledgeValidationError('Enabled must be true or false.')
    result.enabled = raw.enabled
  }
  if (!partial) {
    if (!result.intent || !result.approvedAnswer) throw new KnowledgeValidationError('Intent and approved answer are required.')
    result.title ??= null; result.category ??= null; result.content ??= null
    result.keywords ??= []; result.sourceDocument ??= null; result.sourceVersion ??= null
    result.approvalStatus ??= 'pending'; result.enabled ??= false
  } else if (!Object.keys(result).length) throw new KnowledgeValidationError('No changes were provided.')
  if (result.enabled && result.approvalStatus && result.approvalStatus !== 'approved') throw new KnowledgeValidationError('Only approved entries can be enabled.')
  return result as Partial<KnowledgeInput>
}
