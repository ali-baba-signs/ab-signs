import { designConfigurationsForSize, type DesignType } from '@/lib/products/design-configurations'

export type TemplateCompatibleSize = {
  id?: string
  enabled: boolean
  frontTemplateId?: string | null
  backTemplateId?: string | null
  designConfigurations?: unknown
}

/**
 * Product sizes are the production authority. A template-product link makes a
 * template available to a product; assigning a template directly to a size
 * narrows that availability to that size (and side).
 */
export function isTemplateCompatibleWithSize(templateId: string, size: TemplateCompatibleSize, designType?: DesignType) {
  if (!size.enabled) return false
  const configurations = designConfigurationsForSize(size).filter((configuration) => configuration.enabled && (!designType || configuration.designType === designType))
  const explicitTemplates = configurations.flatMap((configuration) => configuration.designType === 'single_side'
    ? [configuration.singleTemplateId]
    : [configuration.frontTemplateId, configuration.backTemplateId]).filter((value): value is string => Boolean(value))
  return explicitTemplates.length === 0 || explicitTemplates.includes(templateId)
}

export function compatibleSizesForTemplate<T extends TemplateCompatibleSize>(templateId: string, sizes: T[]) {
  return sizes.filter((size) => isTemplateCompatibleWithSize(templateId, size))
}
