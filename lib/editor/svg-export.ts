const SUPPORTED_IMAGE_TYPE = /^image\/(?:png|jpe?g|webp|gif|svg\+xml)$/i

export class GeneratedSvgError extends Error {}

function cloneCanvasJson(canvasJson: Record<string, unknown>) {
  return JSON.parse(JSON.stringify(canvasJson)) as Record<string, unknown>
}

function byteString(bytes: Uint8Array) {
  let value = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    value += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  }
  return value
}

async function imageDataUrl(source: string, fetcher: typeof fetch) {
  let response: Response
  try {
    response = await fetcher(source, { credentials: 'same-origin' })
  } catch (error) {
    throw new GeneratedSvgError('An image used by the design could not be embedded in the production artwork.', { cause: error })
  }
  if (!response.ok) throw new GeneratedSvgError(`An image used by the design returned HTTP ${response.status} during export.`)
  const blob = await response.blob()
  const contentType = (blob.type || response.headers.get('content-type') || '').split(';', 1)[0].trim().toLowerCase()
  if (!SUPPORTED_IMAGE_TYPE.test(contentType)) throw new GeneratedSvgError('An image used by the design has an unsupported format.')
  return `data:${contentType};base64,${btoa(byteString(new Uint8Array(await blob.arrayBuffer())))}`
}

/**
 * Fabric preserves image src values in exported SVG. Make every non-data source
 * self-contained before loading the off-screen render canvas.
 */
export async function prepareCanvasJsonForExport(
  canvasJson: Record<string, unknown>,
  fetcher: typeof fetch = fetch,
) {
  const prepared = cloneCanvasJson(canvasJson)
  const embedded = new Map<string, Promise<string>>()

  const visit = async (value: unknown): Promise<void> => {
    if (Array.isArray(value)) {
      await Promise.all(value.map(visit))
      return
    }
    if (!value || typeof value !== 'object') return
    const record = value as Record<string, unknown>
    if (typeof record.src === 'string' && !record.src.trim().toLowerCase().startsWith('data:image/')) {
      const source = record.src
      let pending = embedded.get(source)
      if (!pending) {
        pending = imageDataUrl(source, fetcher)
        embedded.set(source, pending)
      }
      record.src = await pending
      delete record.crossOrigin
    }
    await Promise.all(Object.values(record).map(visit))
  }

  await visit(prepared)
  return prepared
}

/** Accept only a complete SVG document and guarantee explicit physical dimensions. */
export function ensureCompleteGeneratedSvg(svgMarkup: string, width: string, height: string) {
  const markup = svgMarkup.replace(/^\uFEFF/, '').trim()
  const withoutDeclaration = markup.replace(/^<\?xml\s[^?]*\?>\s*/i, '')
  if (!/^<svg\b/i.test(withoutDeclaration) || !/<\/svg>\s*$/i.test(withoutDeclaration)) {
    throw new GeneratedSvgError('Fabric generated an incomplete SVG document.')
  }
  return markup.replace(/<svg\b([^>]*)>/i, (root, attributes: string) => {
    const withWidth = /\swidth\s*=/i.test(attributes) ? attributes : `${attributes} width="${width}"`
    const withHeight = /\sheight\s*=/i.test(withWidth) ? withWidth : `${withWidth} height="${height}"`
    return `<svg${withHeight}>`
  })
}
