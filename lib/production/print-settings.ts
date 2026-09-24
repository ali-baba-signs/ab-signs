export const PRINT_SETTINGS = { bleed: 3, safeMargin: 5, unit: 'mm' } as const
const MILLIMETRES_PER_UNIT: Record<string, number> = { mm: 1, cm: 10, m: 1000, in: 25.4, ft: 304.8 }

export function millimetres(value: number | string, unit: string) {
  const factor = MILLIMETRES_PER_UNIT[unit]
  const amount = Number(value)
  if (!factor || !Number.isFinite(amount) || amount <= 0) throw new Error('Print measurement is invalid.')
  return amount * factor
}

export function printGeometry(trimWidthMm: number, trimHeightMm: number, bleedMm: number = PRINT_SETTINGS.bleed, safeMarginMm: number = PRINT_SETTINGS.safeMargin) {
  if (![trimWidthMm, trimHeightMm, bleedMm, safeMarginMm].every(Number.isFinite) || trimWidthMm <= 0 || trimHeightMm <= 0 || bleedMm < 0 || safeMarginMm < 0) throw new Error('Print dimensions are invalid.')
  if (safeMarginMm * 2 >= Math.min(trimWidthMm, trimHeightMm)) throw new Error('Safe margin must fit inside the trim size.')
  return {
    trimWidthMm, trimHeightMm, bleedMm, safeMarginMm,
    bleedWidthMm: trimWidthMm + 2 * bleedMm,
    bleedHeightMm: trimHeightMm + 2 * bleedMm,
    safeWidthMm: trimWidthMm - 2 * safeMarginMm,
    safeHeightMm: trimHeightMm - 2 * safeMarginMm,
  }
}

export function cropMarkPath(trimLeft: number, trimTop: number, trimWidth: number, trimHeight: number, bleedX: number, bleedY: number, scaleX: number, scaleY: number) {
  const gapX = bleedX + 1.5 * scaleX, gapY = bleedY + 1.5 * scaleY
  const lengthX = 5 * scaleX, lengthY = 5 * scaleY
  const right = trimLeft + trimWidth, bottom = trimTop + trimHeight
  return [
    `M${trimLeft-gapX-lengthX} ${trimTop}H${trimLeft-gapX}`, `M${trimLeft} ${trimTop-gapY-lengthY}V${trimTop-gapY}`,
    `M${right+gapX} ${trimTop}H${right+gapX+lengthX}`, `M${right} ${trimTop-gapY-lengthY}V${trimTop-gapY}`,
    `M${trimLeft-gapX-lengthX} ${bottom}H${trimLeft-gapX}`, `M${trimLeft} ${bottom+gapY}V${bottom+gapY+lengthY}`,
    `M${right+gapX} ${bottom}H${right+gapX+lengthX}`, `M${right} ${bottom+gapY}V${bottom+gapY+lengthY}`,
  ].join(' ')
}

export function cropMarksSvg(trimLeft: number, trimTop: number, trimWidth: number, trimHeight: number, bleedX: number, bleedY: number, scaleX: number, scaleY: number) {
  return `<g id="crop-marks" fill="none" stroke="#111" stroke-width="0.25mm" vector-effect="non-scaling-stroke"><path d="${cropMarkPath(trimLeft, trimTop, trimWidth, trimHeight, bleedX, bleedY, scaleX, scaleY)}"/></g>`
}
