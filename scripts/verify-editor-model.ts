import { sanitizeSvgMarkup, SvgValidationError } from '../lib/templates/svg-sanitization'
import { validateProductInput } from '../lib/products/validation'
import { createTemplateCanvasSize } from '../lib/templates/size-conversion'
import { FabricObject, loadSVGFromString, util } from 'fabric/node'
import { createUploadKey, validateUpload } from '../lib/storage/upload-validation'

async function generateWithInstalledFabric(svg: string, width: number, height: number) {
  const size = createTemplateCanvasSize(width, height, 'ft')
  const parsed = await loadSVGFromString(sanitizeSvgMarkup(svg))
  const objects = parsed.objects.filter((object): object is FabricObject => Boolean(object))
  if (!objects.length) throw new Error('Fabric SVG parser returned no objects.')
  const root = util.groupSVGElements(objects, parsed.options)
  const canvasData = { version: '7.4.0', objects: [root.toObject()] }
  return { canvasData, ...size }
}

async function main() {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 300"><rect width="600" height="300" fill="#ed1b68"/><circle cx="300" cy="150" r="80" fill="white"/></svg>'
  const first = await generateWithInstalledFabric(svg, 6, 3)
  const resized = await generateWithInstalledFabric(svg, 4, 2)
  if (!Array.isArray(first.canvasData.objects) || !first.canvasData.objects.length) throw new Error('Fabric generation produced an empty canvas.')
  if (first.logicalCanvasWidth !== 1200 || first.logicalCanvasHeight !== 600 || resized.logicalCanvasWidth !== 1200 || resized.logicalCanvasHeight !== 600) throw new Error('Physical-to-canvas aspect conversion is incorrect.')
  try {
    sanitizeSvgMarkup('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
    throw new Error('Unsafe SVG was accepted.')
  } catch (error) {
    if (!(error instanceof SvgValidationError)) throw error
  }
  const validProduct = { sku: 'VERIFY-IMAGE', name: 'Verification product', description: '<p>A valid product description.</p>', basePrice: 10, categoryId: '11111111-1111-4111-8111-111111111111', templateId: null, featured: false, active: true, images: [{ assetId: '22222222-2222-4222-8222-222222222222', key: 'products/verification.webp', url: 'https://assets.invalid/products/verification.webp', isPrimary: true }], sizes: [{ label: '6 × 3 ft', width: 6, height: 3, unit: 'ft', unitPrice: 10, enabled: true }] }
  validateProductInput(validProduct)
  validateProductInput({ ...validProduct, images: [{ id: '33333333-3333-4333-8333-333333333333', url: 'https://assets.invalid/existing.webp', isPrimary: true }] })
  try {
    validateProductInput({ ...validProduct, images: [{ url: 'blob:local-preview', isPrimary: true }] })
    throw new Error('A local-only product image was accepted.')
  } catch (error) {
    if (!(error instanceof Error) || !/has not finished uploading/.test(error.message)) throw error
  }
  const svgKey = createUploadKey({ filename: 'source.svg', contentType: 'image/svg+xml', size: 100, purpose: 'template' }, 'admin')
  const previewKey = createUploadKey({ filename: 'preview.webp', contentType: 'image/webp', size: 100, purpose: 'template' }, 'admin')
  if (!svgKey.includes('/source/') || !previewKey.includes('/previews/')) throw new Error('Template assets were routed to incorrect R2 prefixes.')
  let legacyDefinitionRejected = false
  try { validateUpload({ filename: 'manual.json', contentType: 'application/json', size: 100, purpose: 'template' }) }
  catch { legacyDefinitionRejected = true }
  if (!legacyDefinitionRejected) throw new Error('Manual JSON template upload is still accepted.')
  console.log('Editor model verification passed: safe SVG parsing, unsafe SVG rejection, Fabric JSON generation, physical size mapping, new/existing image validation, local-only image rejection, template R2 routing, and manual JSON rejection.')
}

void main().catch((error) => {
  console.error(`Editor model verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  process.exitCode = 1
})
