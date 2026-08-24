function code(value: string, length: number) {
  const words = value.toUpperCase().match(/[A-Z0-9]+/g) || []
  if (!words.length) return 'X'.repeat(length)
  const initials = words.map((word) => word[0]).join('')
  return (initials.length >= length ? initials : words.join('')).slice(0, length).padEnd(length, 'X')
}

export function productSkuPrefix(categoryName: string, productName: string) {
  return `${code(categoryName, 3)}-${code(productName, 2)}`
}

export function nextProductSku(prefix: string, existing: string[]) {
  const pattern = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d{4,})$`)
  const highest = existing.reduce((max, sku) => Math.max(max, Number(sku.match(pattern)?.[1] || 0)), 0)
  return `${prefix}-${String(highest + 1).padStart(4, '0')}`
}
