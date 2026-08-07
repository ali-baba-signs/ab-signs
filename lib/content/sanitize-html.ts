const allowedTags = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'a',
  'blockquote', 'h2', 'h3', 'div', 'span',
])

function escapeAttribute(value: string) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

function safeHref(value: string) {
  const decoded = value.trim().replace(/&colon;/gi, ':')
  if (/^(https?:|mailto:|tel:|\/|#)/i.test(decoded)) return decoded
  return '#'
}

export function sanitizeRichText(input: unknown) {
  if (typeof input !== 'string') return ''
  const withoutDangerousBlocks = input
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|iframe|object|embed|form)[^>]*>[\s\S]*?<\/\1\s*>/gi, '')

  return withoutDangerousBlocks.replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (tag, rawName: string, rawAttrs: string) => {
    const name = rawName.toLowerCase()
    if (!allowedTags.has(name)) return ''
    if (tag.startsWith('</')) return name === 'br' ? '' : `</${name}>`
    if (name === 'br') return '<br>'

    const attrs: string[] = []
    if (name === 'a') {
      const href = rawAttrs.match(/\bhref\s*=\s*["']([^"']*)["']/i)?.[1]
      if (href) attrs.push(`href="${escapeAttribute(safeHref(href))}"`)
      attrs.push('target="_blank"', 'rel="noopener noreferrer"')
    }
    const align = rawAttrs.match(/text-align\s*:\s*(left|right|center|justify)/i)?.[1]?.toLowerCase()
    if (align && ['p', 'div', 'h2', 'h3'].includes(name)) attrs.push(`style="text-align:${align}"`)
    return `<${name}${attrs.length ? ` ${attrs.join(' ')}` : ''}>`
  }).slice(0, 50000)
}

export function richTextToPlainText(input: string) {
  return sanitizeRichText(input).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
}
