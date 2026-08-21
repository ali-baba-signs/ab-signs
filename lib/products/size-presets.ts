export const BANNER_SIZE_PRESETS = [
  [500, 1000], [600, 900], [1000, 1000], [1000, 1200], [1000, 1500], [1000, 2000], [1000, 3000], [1000, 4000], [1000, 5000],
  [1200, 1200], [1200, 1500], [1200, 2000], [1200, 3000], [1200, 4000], [1200, 5000],
  [1500, 1500], [1500, 2000], [1500, 3000], [1500, 4000], [1500, 5000],
] as const

export const FLAG_TYPES = ['teardrop', 'feather'] as const
export const FLAG_SIZE_GROUPS = ['small', 'medium', 'large', 'extra_large'] as const
export const SIDE_MODES = ['single', 'double'] as const
export const PRODUCT_SIZE_MODES = ['preset_sizes', 'custom_dimensions', 'fixed_variants'] as const

export type ProductSizeMode = typeof PRODUCT_SIZE_MODES[number]
export type SideMode = typeof SIDE_MODES[number]

/** Standard flag print areas; assembled heights are hardware measurements. */
export const FLAG_PRINT_PRESETS = {
  small: { label: 'Small – 2.6m', width: 50, height: 200, assembledHeightDescription: 'Approximately 2.6 m assembled height' },
  medium: { label: 'Medium – 3.4m', width: 60, height: 260, assembledHeightDescription: 'Approximately 3.4 m assembled height' },
  large: { label: 'Large – 4.5m', width: 70, height: 340, assembledHeightDescription: 'Approximately 4.5 m assembled height' },
  extra_large: { label: 'Extra Large – 5.5m', width: 80, height: 410, assembledHeightDescription: 'Approximately 5.5 m assembled height' },
} as const
