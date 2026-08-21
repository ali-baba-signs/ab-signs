export type TemplateCompatibleSize = {
  id: string
  enabled: boolean
  frontTemplateId?: string | null
  backTemplateId?: string | null
}

/**
 * Product sizes are the production authority. A template-product link makes a
 * template available to a product; assigning a template directly to a size
 * narrows that availability to that size (and side).
 */
export function isTemplateCompatibleWithSize(templateId: string, size: TemplateCompatibleSize) {
  if (!size.enabled) return false
  const explicitTemplates = [size.frontTemplateId, size.backTemplateId].filter((value): value is string => Boolean(value))
  return explicitTemplates.length === 0 || explicitTemplates.includes(templateId)
}

export function compatibleSizesForTemplate<T extends TemplateCompatibleSize>(templateId: string, sizes: T[]) {
  return sizes.filter((size) => isTemplateCompatibleWithSize(templateId, size))
}

