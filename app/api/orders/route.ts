import { NextRequest, NextResponse } from 'next/server'
import { desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { customerArtworks, designs, orderItems, orderStatusHistory, orders, paymentRecords, productCategories, productSizes, productTemplateSizePrices, products, templateSizes, templates } from '@/lib/db/schema'
import { getSession } from '@/lib/auth/middleware'
import { getAdminSession } from '@/lib/auth/require-admin'
import { isPaymentProvider } from '@/lib/payments/providers'
import { loadStoreSettings } from '@/lib/store/load-settings'
import { designDeadline } from '@/lib/orders/workflow'
import { parseMeasurement } from '@/lib/measurements'

interface CheckoutItem { productId?: string; sizeId?: string; templateId?: string | null; designId?: string | null; artworkId?: string | null; designSource?: 'online_editor' | 'customer_upload' | 'design_assistance'; quantity?: number; specifications?: Record<string, string> }
interface Address { firstName?: string; lastName?: string; address?: string; city?: string; state?: string; postalCode?: string; country?: string; phone?: string }

function cleanAddress(value: unknown) {
  const input = value as Address
  const required = ['firstName', 'lastName', 'address', 'city', 'postalCode', 'country'] as const
  for (const field of required) if (typeof input?.[field] !== 'string' || input[field]!.trim().length < 1) throw new Error(`Shipping ${field} is required.`)
  return Object.fromEntries(Object.entries(input).map(([key, item]) => [key, typeof item === 'string' ? item.trim().slice(0, 500) : '']))
}

function cents(value: number) { return Math.round(value * 100) }
function amount(value: number) { return (value / 100).toFixed(2) }

export async function GET() {
  try {
    const [session, adminSession] = await Promise.all([getSession(), getAdminSession()])
    if (!session?.user && !adminSession?.user) return NextResponse.json({ error: { code: 'AUTH_REQUIRED', message: 'Sign in to view orders.' } }, { status: 401 })
    const rows = await db.select().from(orders).where(adminSession?.user ? undefined : eq(orders.userId, session!.user.id)).orderBy(desc(orders.createdAt))
    const ids = rows.map((order) => order.id)
    const [items, payments, history] = ids.length ? await Promise.all([
      db.select().from(orderItems).where(inArray(orderItems.orderId, ids)),
      db.select().from(paymentRecords).where(inArray(paymentRecords.orderId, ids)),
      db.select().from(orderStatusHistory).where(inArray(orderStatusHistory.orderId, ids)).orderBy(desc(orderStatusHistory.changedAt)),
    ]) : [[], [], []]
    const itemProductIds = [...new Set(items.map((item) => item.productId))]
    const productRows = itemProductIds.length ? await db.select({ id: products.id, name: products.name, categoryId: products.categoryId }).from(products).where(inArray(products.id, itemProductIds)) : []
    const categoryIds = [...new Set(productRows.map((product) => product.categoryId))]
    const categoryRows = categoryIds.length ? await db.select({ id: productCategories.id, name: productCategories.name }).from(productCategories).where(inArray(productCategories.id, categoryIds)) : []
    return NextResponse.json({ data: { orders: rows.map((order) => ({ ...order, items: items.filter((item) => item.orderId === order.id).map((item) => { const product = productRows.find((row) => row.id === item.productId); return { ...item, product: product ? { ...product, categoryName: categoryRows.find((category) => category.id === product.categoryId)?.name || '' } : null } }), payments: payments.filter((payment) => payment.orderId === order.id), history: history.filter((item) => item.orderId === order.id) })) } })
  } catch (error) {
    console.error('Orders load failed', error)
    return NextResponse.json({ error: { code: 'ORDERS_LOAD_FAILED', message: 'Orders could not be loaded.' } }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>
    const items = Array.isArray(body.items) ? body.items as CheckoutItem[] : []
    const customer = body.customer as Record<string, unknown>
    const email = typeof customer?.email === 'string' ? customer.email.trim().toLowerCase().slice(0, 255) : ''
    const idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim().slice(0, 100) : ''
    const paymentMethod = body.paymentMethod
    if (!items.length || items.length > 50) throw new Error('The cart must contain between 1 and 50 items.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('A valid customer email is required.')
    if (!/^[a-zA-Z0-9_-]{16,100}$/.test(idempotencyKey)) throw new Error('A valid checkout idempotency key is required.')
    if (!isPaymentProvider(paymentMethod)) throw new Error('Select a valid payment method.')
    const shippingAddress = cleanAddress(body.shippingAddress)
    const billingAddress = body.billingSameAsShipping === false ? cleanAddress(body.billingAddress) : shippingAddress
    const settings = await loadStoreSettings()
    const session = await getSession()
    if (!session?.user && !settings.allowGuestCheckout) return NextResponse.json({ error: { code: 'AUTH_REQUIRED', message: 'Sign in before checking out.' } }, { status: 401 })

    const [existing] = await db.select().from(orders).where(eq(orders.idempotencyKey, idempotencyKey)).limit(1)
    if (existing) {
      if (existing.customerEmail !== email || existing.userId !== (session?.user.id ?? null)) return NextResponse.json({ error: { code: 'IDEMPOTENCY_CONFLICT', message: 'This checkout token is already in use.' } }, { status: 409 })
      return NextResponse.json({ data: { order: existing, duplicate: true } })
    }

    const productIds = [...new Set(items.map((item) => item.productId).filter((id): id is string => Boolean(id)))]
    const sizeIds = [...new Set(items.map((item) => item.sizeId).filter((id): id is string => Boolean(id)))]
    if (productIds.length !== new Set(items.map((item) => item.productId)).size || !sizeIds.length) throw new Error('Every cart item needs a valid product and size.')
    const designIds = [...new Set(items.map((item) => item.designId).filter((id): id is string => Boolean(id)))]
    const artworkIds = [...new Set(items.map((item) => item.artworkId).filter((id): id is string => Boolean(id)))]
    const [productRows, sizeRows, templateSizeRows, priceRows, templateRows, designRows, artworkRows] = await Promise.all([
      db.select().from(products).where(inArray(products.id, productIds)),
      db.select().from(productSizes).where(inArray(productSizes.id, sizeIds)),
      db.select().from(templateSizes).where(inArray(templateSizes.id, sizeIds)),
      db.select().from(productTemplateSizePrices),
      db.select({ id: templates.id, status: templates.status }).from(templates),
      designIds.length ? db.select().from(designs).where(inArray(designs.id, designIds)) : Promise.resolve([]),
      artworkIds.length ? db.select().from(customerArtworks).where(inArray(customerArtworks.id, artworkIds)) : Promise.resolve([]),
    ])
    const calculatedItems = items.map((item) => {
      const product = productRows.find((row) => row.id === item.productId && row.active)
      const legacySize = sizeRows.find((row) => row.id === item.sizeId && row.productId === item.productId && row.enabled)
      const templateSize = product?.templateId && product.sizeMode === 'template_sizes' ? templateSizeRows.find((row) => row.id === item.sizeId && row.templateId === product.templateId && row.enabled) : null
      const price = templateSize ? priceRows.find((row) => row.productId === product?.id && row.templateSizeId === templateSize.id && row.enabled) : null
      const size = templateSize ? { ...templateSize, unitPrice: price?.unitPrice, productId: product?.id } : legacySize
      const quantity = Number(item.quantity)
      if (!product || !size || (templateSize && !price)) throw new Error('A product or selected size is no longer available.')
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) throw new Error('Quantity must be between 1 and 1000.')
      const selectedTemplateId = item.templateId || product.templateId
      if (selectedTemplateId && !templateRows.some((template) => template.id === selectedTemplateId && template.status === 'active')) throw new Error('The selected editable template is no longer available.')
      const design = item.designId ? designRows.find((row) => row.id === item.designId && row.productId === product.id && row.templateId === selectedTemplateId && row.userId === session?.user.id) : null
      if (item.designId && !design) throw new Error('The selected customization is unavailable or does not belong to this account.')
      const artwork = item.artworkId ? artworkRows.find((row) => row.id === item.artworkId && row.productId === product.id && row.userId === session?.user.id && (row.templateSizeId === size.id || row.productSizeId === size.id)) : null
      const designSource = item.designSource || (design ? 'online_editor' : artwork ? 'customer_upload' : 'design_assistance')
      if (designSource === 'online_editor' && !design) throw new Error('Save the online customization before checkout.')
      if (designSource === 'customer_upload' && !artwork) throw new Error('The uploaded artwork is unavailable or belongs to another account.')
      const customHeight = item.specifications?.customHeight
      const customWidth = item.specifications?.customWidth
      const customRequested = customHeight !== undefined || customWidth !== undefined
      if (customRequested && (!product.allowCustomDimensions || !legacySize || product.sizeMode === 'fixed_variants')) throw new Error('Custom dimensions are not available for this product.')
      const finalHeight = customRequested ? parseMeasurement(customHeight, 'Custom height').normalized : size.height
      const finalWidth = customRequested ? parseMeasurement(customWidth, 'Custom width').normalized : size.width
      if (customRequested && (!size.height || !size.width)) throw new Error('The custom-size pricing reference has no configured dimensions.')
      const areaRatio = customRequested ? Number(finalHeight) * Number(finalWidth) / (Number(size.height) * Number(size.width)) : 1
      const unitCents = cents(Number(size.unitPrice) * areaRatio)
      return { product, size: { ...size, height: finalHeight, width: finalWidth, label: customRequested ? `${finalHeight} × ${finalWidth} ${size.unit}` : size.label }, templateSizeId: templateSize?.id || null, productSizeId: legacySize?.id || null, quantity, templateId: selectedTemplateId || null, designId: design?.id || null, artworkId: artwork?.id || null, designSource, unitCents, totalCents: unitCents * quantity, specifications: item.specifications ?? {} }
    })
    const subtotalCents = calculatedItems.reduce((sum, item) => sum + item.totalCents, 0)
    const shippingCents = subtotalCents >= cents(settings.freeShippingThreshold) ? 0 : cents(settings.shippingCost)
    const taxCents = Math.round(subtotalCents * settings.taxRate / 100)
    const totalCents = subtotalCents + shippingCents + taxCents
    const orderNumber = `ABS-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`
    const [order] = await db.transaction(async (tx) => {
      const rows = await tx.insert(orders).values({
        userId: session?.user.id ?? null, orderNumber, status: 'pending_design_confirmation', paymentStatus: 'awaiting_payment', paymentMethod, designConfirmationDeadline: designDeadline(),
        currency: settings.currency, customerEmail: email, idempotencyKey, totalAmount: amount(totalCents), taxAmount: amount(taxCents), shippingAmount: amount(shippingCents),
        shippingAddress, billingAddress, notes: typeof body.notes === 'string' ? body.notes.trim().slice(0, 2000) : null,
      }).returning()
      await tx.insert(orderItems).values(calculatedItems.map((item) => ({
        orderId: rows[0].id, productId: item.product.id, productSizeId: item.productSizeId, templateSizeId: item.templateSizeId, templateId: item.templateId, designId: item.designId, customerArtworkId: item.artworkId, designSource: item.designSource,
        quantity: item.quantity, unitPrice: amount(item.unitCents), totalPrice: amount(item.totalCents), specifications: { ...item.specifications, productName: item.product.name, variant: item.size.label, sizeLabel: item.size.label, unit: item.size.unit, width: item.size.width, height: item.size.height, sideMode: 'sideMode' in item.size ? item.size.sideMode : 'single', designSource: item.designSource },
      })))
      await tx.insert(orderStatusHistory).values({ orderId: rows[0].id, status: 'pending_design_confirmation', newStatus: 'pending_design_confirmation', changedBy: session?.user.id ?? null, notes: 'Order placed and awaiting design confirmation.', customerVisibleNote: 'Your design is awaiting confirmation.', expectedCompletionAt: rows[0].designConfirmationDeadline })
      return rows
    })
    return NextResponse.json({ data: { order, totals: { subtotal: amount(subtotalCents), tax: amount(taxCents), shipping: amount(shippingCents), total: amount(totalCents), currency: settings.currency } } }, { status: 201 })
  } catch (error) {
    console.error('Order create failed', error)
    const message = error instanceof Error && /cart|valid|available|Quantity|Shipping|customer|payment|idempotency|product|size|template/i.test(error.message) ? error.message : 'The order could not be created.'
    return NextResponse.json({ error: { code: 'ORDER_CREATE_FAILED', message } }, { status: 400 })
  }
}
