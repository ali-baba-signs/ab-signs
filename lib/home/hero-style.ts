export interface HeroStyleConfig {
  headingColor: string
  headingSize: number
  headingWeight: number
  descriptionColor: string
  descriptionSize: number
  buttonColor: string
  buttonTextColor: string
  textAlignment: 'left' | 'center' | 'right'
  eyebrowColor: string
  eyebrowBackgroundColor: string
  eyebrowSize: number
  eyebrowWeight: number
  eyebrowRadius: number
}

export const DEFAULT_HERO_STYLE: HeroStyleConfig = {
  headingColor: '#ffffff',
  headingSize: 72,
  headingWeight: 900,
  descriptionColor: '#ffffff',
  descriptionSize: 18,
  buttonColor: '#ed1b68',
  buttonTextColor: '#ffffff',
  textAlignment: 'left',
  eyebrowColor: '#ffffff',
  eyebrowBackgroundColor: '#ed1b68',
  eyebrowSize: 12,
  eyebrowWeight: 700,
  eyebrowRadius: 999,
}

const alignments = new Set<HeroStyleConfig['textAlignment']>(['left', 'center', 'right'])
const weights = new Set([100, 200, 300, 400, 500, 600, 700, 800, 900])

function color(value: unknown, fallback: string) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallback
}

function numberInRange(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.round(parsed))) : fallback
}

function weight(value: unknown, fallback: number) {
  const parsed = Number(value)
  return weights.has(parsed) ? parsed : fallback
}

export function normalizeHeroStyle(value: unknown): HeroStyleConfig {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  return {
    headingColor: color(input.headingColor, DEFAULT_HERO_STYLE.headingColor),
    headingSize: numberInRange(input.headingSize, DEFAULT_HERO_STYLE.headingSize, 24, 112),
    headingWeight: weight(input.headingWeight, DEFAULT_HERO_STYLE.headingWeight),
    descriptionColor: color(input.descriptionColor, DEFAULT_HERO_STYLE.descriptionColor),
    descriptionSize: numberInRange(input.descriptionSize, DEFAULT_HERO_STYLE.descriptionSize, 12, 36),
    buttonColor: color(input.buttonColor, DEFAULT_HERO_STYLE.buttonColor),
    buttonTextColor: color(input.buttonTextColor, DEFAULT_HERO_STYLE.buttonTextColor),
    textAlignment: alignments.has(input.textAlignment as HeroStyleConfig['textAlignment']) ? input.textAlignment as HeroStyleConfig['textAlignment'] : DEFAULT_HERO_STYLE.textAlignment,
    eyebrowColor: color(input.eyebrowColor, DEFAULT_HERO_STYLE.eyebrowColor),
    eyebrowBackgroundColor: color(input.eyebrowBackgroundColor, DEFAULT_HERO_STYLE.eyebrowBackgroundColor),
    eyebrowSize: numberInRange(input.eyebrowSize, DEFAULT_HERO_STYLE.eyebrowSize, 9, 24),
    eyebrowWeight: weight(input.eyebrowWeight, DEFAULT_HERO_STYLE.eyebrowWeight),
    eyebrowRadius: numberInRange(input.eyebrowRadius, DEFAULT_HERO_STYLE.eyebrowRadius, 0, 999),
  }
}
