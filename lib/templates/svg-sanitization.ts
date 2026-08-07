const forbiddenElements = /<\s*(script|foreignObject|iframe|object|embed|audio|video|canvas|form|input|button|textarea|select|link|meta)\b/i
const eventAttribute = /\son[a-z0-9_-]+\s*=/i
const unsafeProtocol = /(javascript\s*:|vbscript\s*:|data\s*:\s*text\/html)/i
const externalReference = /(?:href|xlink:href|src)\s*=\s*["']\s*(?:https?:|\/\/)/i
const externalCssUrl = /url\(\s*["']?\s*(?:https?:|\/\/|javascript:)/i

export class SvgValidationError extends Error {}

export function sanitizeSvgMarkup(value: string) {
  if (!value || value.length > 10 * 1024 * 1024) throw new SvgValidationError('SVG must be smaller than 10 MB.')
  const svg = value.replace(/^\uFEFF/, '').replace(/<!--([\s\S]*?)-->/g, '').trim()
  if (!/^<svg\b/i.test(svg) || !/<\/svg>\s*$/i.test(svg)) throw new SvgValidationError('The file is not a complete SVG document.')
  if (/<!doctype|<!entity|<\?xml-stylesheet/i.test(svg)) throw new SvgValidationError('SVG document types, entities, and external stylesheets are not supported.')
  if (forbiddenElements.test(svg)) throw new SvgValidationError('SVG contains a forbidden embedded element.')
  if (eventAttribute.test(svg)) throw new SvgValidationError('SVG event-handler attributes are not allowed.')
  if (unsafeProtocol.test(svg) || externalReference.test(svg) || externalCssUrl.test(svg)) throw new SvgValidationError('SVG contains an unsafe or external reference.')
  if (/<style\b[^>]*>[\s\S]*@import/i.test(svg)) throw new SvgValidationError('Imported SVG stylesheets are not supported.')
  return svg.replace(/<\?xml[\s\S]*?\?>/i, '').trim()
}

export function validateFabricCanvasData(value: unknown) {
  if (!value || typeof value !== 'object') throw new SvgValidationError('Generated Fabric data is missing.')
  const data = value as { objects?: unknown[] }
  if (!Array.isArray(data.objects) || data.objects.length === 0) throw new SvgValidationError('The SVG did not produce any editable Fabric objects.')
  const serialized = JSON.stringify(value)
  if (serialized.length > 5 * 1024 * 1024) throw new SvgValidationError('Generated Fabric data is too large to store safely.')
  if (/"(?:src|href)"\s*:\s*"(?:https?:|\/\/|javascript:)/i.test(serialized)) throw new SvgValidationError('Generated Fabric data contains an external reference.')
  return value as Record<string, unknown>
}
