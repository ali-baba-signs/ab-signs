import { printGeometry } from '@/lib/production/print-settings'

export function PrintPreparationGuide({ widthMm, heightMm, bleedMm, safeMarginMm, cropMarks = true }: { widthMm: number; heightMm: number; bleedMm: number; safeMarginMm: number; cropMarks?: boolean }) {
  const geometry = printGeometry(widthMm, heightMm, bleedMm, safeMarginMm)
  const scale = Math.min(260 / widthMm, 180 / heightMm)
  const width = widthMm * scale, height = heightMm * scale
  const bleed = bleedMm * scale, safety = safeMarginMm * scale
  const margin = 25 + bleed
  const x = margin, y = margin, right = x + width, bottom = y + height
  const gap = bleed + 4, length = 12
  const marks = cropMarks ? [
    `M${x-gap-length} ${y}H${x-gap}`, `M${x} ${y-gap-length}V${y-gap}`,
    `M${right+gap} ${y}H${right+gap+length}`, `M${right} ${y-gap-length}V${y-gap}`,
    `M${x-gap-length} ${bottom}H${x-gap}`, `M${x} ${bottom+gap}V${bottom+gap+length}`,
    `M${right+gap} ${bottom}H${right+gap+length}`, `M${right} ${bottom+gap}V${bottom+gap+length}`,
  ].join(' ') : ''
  const size = (value: number) => Number(value.toFixed(2))
  return <section aria-label="Print preparation geometry" className="rounded-lg border bg-white p-4">
    <h3 className="font-semibold">Print preparation</h3>
    <p className="mt-1 text-xs text-muted-foreground">Guide diagram only. Your uploaded file is unchanged.</p>
    <svg className="mx-auto mt-4 max-h-64 w-full" viewBox={`0 0 ${width + margin * 2} ${height + margin * 2}`} role="img" aria-label={`Trim ${size(widthMm)} by ${size(heightMm)} millimetres, ${size(bleedMm)} millimetre bleed per side, ${size(safeMarginMm)} millimetre safe margin`}>
      <rect x={x-bleed} y={y-bleed} width={width+bleed*2} height={height+bleed*2} fill="#f4f4f5" stroke="#db2777" strokeDasharray="4 3" strokeWidth="1" />
      <rect x={x} y={y} width={width} height={height} fill="#fff" stroke="#111827" strokeWidth="1" />
      <rect x={x+safety} y={y+safety} width={width-safety*2} height={height-safety*2} fill="none" stroke="#15803d" strokeDasharray="4 3" strokeWidth="1" />
      {marks && <path d={marks} fill="none" stroke="#111827" strokeWidth="1" />}
    </svg>
    <dl className="mt-3 grid gap-1 text-xs sm:grid-cols-2">
      <div><dt className="font-semibold">Trim</dt><dd>{size(widthMm)} × {size(heightMm)} mm</dd></div>
      <div><dt className="font-semibold">Bleed canvas</dt><dd>{size(geometry.bleedWidthMm)} × {size(geometry.bleedHeightMm)} mm</dd></div>
      <div><dt className="font-semibold">Safe area</dt><dd>{size(geometry.safeWidthMm)} × {size(geometry.safeHeightMm)} mm</dd></div>
      <div><dt className="font-semibold">Crop marks</dt><dd>{cropMarks ? 'Outside bleed on generated exports' : 'Off'}</dd></div>
    </dl>
  </section>
}
