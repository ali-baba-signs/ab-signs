type ErrorDetails = {
  code?: unknown
  constraint?: unknown
  detail?: unknown
  message?: unknown
  cause?: unknown
}

const SAFE_PRODUCT_VALIDATION_MESSAGE = /(?:sku|product name|description|category|image|size|variant|dimension|price|amount|design option|template|front|back|single|double|bleed|margin|trim|enable|select|add|upload|available|ready|must|required|requires|needs|invalid|not found|belong)/i

function errorChain(error: unknown) {
  const chain: ErrorDetails[] = []
  let current = error
  const visited = new Set<unknown>()

  while (current && typeof current === 'object' && chain.length < 6 && !visited.has(current)) {
    visited.add(current)
    const details = current as ErrorDetails
    chain.push(details)
    current = details.cause
  }

  return chain
}

export function isProductSkuConflict(error: unknown) {
  return errorChain(error).some((details) => {
    if (String(details.code || '') !== '23505') return false
    const databaseDetails = `${String(details.constraint || '')} ${String(details.detail || '')} ${String(details.message || '')}`
    return /sku/i.test(databaseDetails)
  })
}

export function productWriteErrorMessage(error: unknown, action: 'created' | 'updated') {
  if (isProductSkuConflict(error)) {
    return 'That SKU is already in use. Enter a unique SKU or leave the field blank to generate one.'
  }

  const message = error instanceof Error ? error.message.trim() : ''
  if (message && SAFE_PRODUCT_VALIDATION_MESSAGE.test(message)) return message

  return `The product could not be ${action}. Review the product details and try again.`
}
