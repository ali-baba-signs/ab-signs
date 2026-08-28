export type DesignType = 'single_side' | 'double_side'

export type SizeDesignConfiguration = {
  designType: DesignType
  enabled: boolean
  singleTemplateId?: string | null
  frontTemplateId?: string | null
  backTemplateId?: string | null
}

type LegacySizeConfiguration = {
  sideMode?: string | null
  frontTemplateId?: string | null
  backTemplateId?: string | null
  designConfigurations?: unknown
}

type ProductionSizeIdentity = LegacySizeConfiguration & {
  id: string
  width?: string | number | null
  height?: string | number | null
  unit?: string | null
  variantType?: string | null
  sizeGroup?: string | null
  label?: string | null
}

export function designConfigurationsForSize(size: LegacySizeConfiguration): SizeDesignConfiguration[] {
  if (Array.isArray(size.designConfigurations)) {
    const seen = new Set<DesignType>()
    const configurations = size.designConfigurations.flatMap((raw) => {
      if (!raw || typeof raw !== 'object') return []
      const row = raw as Record<string, unknown>
      const designType: DesignType | null = row.designType === 'single_side' ? 'single_side' : row.designType === 'double_side' ? 'double_side' : null
      if (!designType || seen.has(designType)) return []
      seen.add(designType)
      return [{
        designType,
        enabled: row.enabled !== false,
        singleTemplateId: typeof row.singleTemplateId === 'string' ? row.singleTemplateId : null,
        frontTemplateId: typeof row.frontTemplateId === 'string' ? row.frontTemplateId : null,
        backTemplateId: typeof row.backTemplateId === 'string' ? row.backTemplateId : null,
      }]
    })
    if (configurations.length) return configurations
  }

  return size.sideMode === 'double'
    ? [{ designType: 'double_side', enabled: true, frontTemplateId: size.frontTemplateId || null, backTemplateId: size.backTemplateId || null }]
    : [{ designType: 'single_side', enabled: true, singleTemplateId: size.frontTemplateId || null }]
}

export function enabledDesignConfigurations(size: LegacySizeConfiguration) {
  return designConfigurationsForSize(size).filter((configuration) => configuration.enabled)
}

export function designConfigurationForSize(size: LegacySizeConfiguration, designType: DesignType) {
  return enabledDesignConfigurations(size).find((configuration) => configuration.designType === designType) || null
}

function dimensionKey(value: string | number | null | undefined) {
  const numeric = Number(value)
  return value !== null && value !== undefined && value !== '' && Number.isFinite(numeric) ? String(numeric) : ''
}

export function productionSizeIdentity(size: ProductionSizeIdentity) {
  const dimensions = `${dimensionKey(size.width)}x${dimensionKey(size.height)}:${size.unit || ''}`
  if (dimensionKey(size.width) && dimensionKey(size.height)) return `${size.variantType || ''}:${size.sizeGroup || ''}:${dimensions}`
  return `${size.variantType || ''}:${size.sizeGroup || ''}:${String(size.label || '').trim().toLowerCase()}:${size.id}`
}

export function uniqueProductionSizes<T extends ProductionSizeIdentity>(sizes: T[]) {
  const seen = new Set<string>()
  return sizes.filter((size) => {
    const key = productionSizeIdentity(size)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function designSelectionsForProductionSize<T extends ProductionSizeIdentity>(selectedSize: T, allSizes: T[]) {
  const identity = productionSizeIdentity(selectedSize)
  const seen = new Set<DesignType>()
  return allSizes.flatMap((size) => productionSizeIdentity(size) === identity
    ? enabledDesignConfigurations(size).flatMap((configuration) => {
        if (seen.has(configuration.designType)) return []
        seen.add(configuration.designType)
        return [{ size, configuration }]
      })
    : [])
}

export function primaryLegacyConfiguration(configurations: SizeDesignConfiguration[]) {
  const enabled = configurations.filter((configuration) => configuration.enabled)
  const selected = enabled.find((configuration) => configuration.designType === 'single_side') || enabled[0]
  if (!selected || selected.designType === 'single_side') return {
    sideMode: 'single' as const,
    frontTemplateId: selected?.singleTemplateId || null,
    backTemplateId: null,
  }
  return { sideMode: 'double' as const, frontTemplateId: selected.frontTemplateId || null, backTemplateId: selected.backTemplateId || null }
}
