import type { DesignTemplate } from './types'

export async function listDesignTemplates() {
  const productId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('productId') : null
  const response = await fetch(productId ? `/api/templates?productId=${encodeURIComponent(productId)}` : '/api/templates', { cache: 'no-store' })
  const payload = await response.json()
  if (!response.ok) throw new Error(payload.error?.message || 'Design Online templates could not be loaded.')
  return (payload.data.templates as Array<Record<string, unknown>>).map((row) => {
    const products = Array.isArray(row.products) ? row.products as Array<Record<string, unknown>> : []
    const sizes = Array.isArray(row.sizes) ? row.sizes as Array<Record<string, unknown>> : []
    const product = products[0]
    const size = sizes.find((item) => item.isDefault) || sizes[0]
    return {
      id: String(row.id), name: String(row.name), category: String(row.category || 'Templates'), productType: 'signage',
      thumbnail: String(row.previewUrl), jsonFile: '', width: Number(row.logicalCanvasWidth || 1200), height: Number(row.logicalCanvasHeight || 600),
      productId: product?.id ? String(product.id) : undefined, sizeId: size?.id ? String(size.id) : undefined,
    } satisfies DesignTemplate
  })
}

export async function fetchTemplate(template: DesignTemplate) {
  const params = new URLSearchParams()
  if (template.productId) params.set('productId', template.productId)
  if (template.sizeId) params.set('sizeId', template.sizeId)
  params.set('editor', '1')
  const response = await fetch(`/api/templates/${template.id}?${params}`, { cache: 'no-store' })
  const payload = await response.json()
  if (!response.ok) throw new Error(payload.error?.message || `Unable to load ${template.name}`)
  const json: unknown = payload.data.template.canvasData
  if (!json || typeof json !== 'object' || !Array.isArray((json as { objects?: unknown }).objects)) throw new Error('Invalid Fabric template data')
  return { json: json as Record<string, unknown>, productConfig: payload.data.productConfig, fitMode: payload.data.fitMode || 'contain' }
}
