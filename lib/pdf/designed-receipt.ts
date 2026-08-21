export interface ReceiptItem { name: string; sku: string; size: string; options: string; quantity: number; unitPrice: number; lineTotal: number }
export interface ReceiptData {
  storeName: string; storeEmail: string; storePhone: string; storeAddress: string; website?: string
  orderNumber: string; orderDate: string; paymentDate: string; fulfilmentType: string; receiptNumber: string; paymentStatus: string
  customerName: string; customerEmail: string; shippingAddress: string
  stripePaymentIntentId: string; cardBrand: string; cardLast4: string; currency: string; items: ReceiptItem[]
  subtotal: number; discount: number; tax: number; shipping: number; total: number; generatedAt: string
}

const PINK: RGB = [0.93, 0.11, 0.41]
const GREEN: RGB = [0.05, 0.54, 0.31]
const PURPLE: RGB = [0.39, 0.36, 1]
const GRAY: RGB = [0.4, 0.4, 0.4]
type RGB = [number, number, number]

function escapePdf(value: string) { return value.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)').replaceAll(/[^\x20-\x7E]/g, '?') }
function money(currency: string, amount: number) { return `${currency} $${amount.toFixed(2)}` }
function safe(value: string, max = 90) { const clean = value.replace(/\s+/g, ' ').trim(); return clean.length > max ? `${clean.slice(0, max - 3)}...` : clean }

class Page {
  commands: string[] = []
  text(x: number, y: number, value: string, size = 10, bold = false, color: RGB = [0.17, 0.17, 0.17]) { this.commands.push('BT', `${color.join(' ')} rg`, `/${bold ? 'F2' : 'F1'} ${size} Tf`, `${x} ${y} Td`, `(${escapePdf(value)}) Tj`, 'ET') }
  right(x: number, y: number, value: string, size = 10, bold = false, color: RGB = [0.17, 0.17, 0.17]) { this.text(x - value.length * size * 0.5, y, value, size, bold, color) }
  rect(x: number, y: number, width: number, height: number, fill: RGB, stroke?: RGB) { this.commands.push(`${fill.join(' ')} rg`, `${x} ${y} ${width} ${height} re f`); if (stroke) this.commands.push(`${stroke.join(' ')} RG`, '0.7 w', `${x} ${y} ${width} ${height} re S`) }
  line(x1: number, y1: number, x2: number, y2: number, color: RGB = [0.9, 0.9, 0.9], width = 1) { this.commands.push(`${color.join(' ')} RG`, `${width} w`, `${x1} ${y1} m ${x2} ${y2} l S`) }
}

function header(page: Page, data: ReceiptData, number: number, count: number) {
  page.text(42, 795, data.storeName, 22, true, PINK)
  page.text(42, 779, 'Custom Print & Signage Australia', 9, false, GRAY)
  page.right(553, 798, data.storeName, 11, true)
  page.right(553, 785, safe(data.storeAddress, 58), 8, false, GRAY)
  page.right(553, 773, `${data.storePhone} | ${data.storeEmail}`, 8, false, GRAY)
  page.line(42, 760, 553, 760, [0.9, 0.9, 0.9], 2)
  page.text(42, 730, 'PAYMENT RECEIPT', 18, true, PINK)
  page.text(42, 713, `Order Ref: ${data.orderNumber}`, 10, false, GRAY)
  page.rect(463, 716, 90, 25, [0.9, 0.98, 0.94]); page.right(544, 725, data.paymentStatus.toUpperCase(), 9, true, GREEN)
  page.text(42, 28, `${data.storeName} | Generated ${data.generatedAt}`, 7, false, GRAY)
  page.right(553, 28, `Page ${number} of ${count}`, 7, false, GRAY)
}

function renderPage(data: ReceiptData, items: ReceiptItem[], number: number, count: number, first: boolean, last: boolean) {
  const page = new Page(); header(page, data, number, count); let y = 680
  if (first) {
    page.rect(42, 594, 247, 85, [0.98, 0.98, 0.98], [0.92, 0.92, 0.92]); page.rect(306, 594, 247, 85, [0.98, 0.98, 0.98], [0.92, 0.92, 0.92])
    page.text(55, 660, 'ORDER DETAILS', 8, true, GRAY); page.text(55, 643, `Order date: ${safe(data.orderDate, 32)}`, 8); page.text(55, 629, `Payment date: ${safe(data.paymentDate, 30)}`, 8); page.text(55, 615, `Fulfilment: ${data.fulfilmentType}`, 8); page.text(55, 601, `Receipt ID: ${safe(data.receiptNumber, 35)}`, 8)
    page.text(319, 660, 'CUSTOMER & DELIVERY', 8, true, GRAY); page.text(319, 643, safe(data.customerName || data.customerEmail, 40), 9, true); page.text(319, 629, safe(data.customerEmail, 43), 8); page.text(319, 615, safe(data.shippingAddress, 46), 8, false, GRAY); page.text(319, 602, safe(data.shippingAddress.slice(46), 46), 8, false, GRAY)
    page.rect(42, 524, 511, 53, [0.985, 0.99, 1], [0.88, 0.91, 0.94]); page.rect(42, 524, 4, 53, PURPLE)
    page.text(56, 559, 'Secure Payment via Stripe', 9, true, [0.04, 0.15, 0.25]); page.rect(174, 555, 90, 13, PURPLE); page.text(180, 558, '256-BIT SSL ENCRYPTED', 6, true, [1, 1, 1])
    page.text(56, 543, `Payment Intent ID: ${safe(data.stripePaymentIntentId, 54)}`, 7, false, [0.32, 0.37, 0.5]); page.text(56, 531, `Card: ${data.cardLast4 === 'Not recorded' ? 'Not recorded' : `${data.cardBrand.toUpperCase()} **** ${data.cardLast4}`}`, 7, false, [0.32, 0.37, 0.5]); page.right(540, 548, 'VERIFIED & SETTLED', 8, true, GREEN); page.right(540, 535, 'Stripe secure payment', 7, false, GRAY); y = 498
  }
  page.rect(42, y - 22, 511, 22, PINK); page.text(52, y - 15, 'ITEM DESCRIPTION', 8, true, [1, 1, 1]); page.right(397, y - 15, 'QTY', 8, true, [1, 1, 1]); page.right(474, y - 15, 'PRICE', 8, true, [1, 1, 1]); page.right(544, y - 15, 'TOTAL', 8, true, [1, 1, 1]); y -= 22
  for (const item of items) {
    page.text(52, y - 14, safe(`${item.name} (${item.sku})`, 48), 8, true); page.text(52, y - 27, safe(`Size: ${item.size} | Options: ${item.options}`, 65), 7, false, GRAY)
    page.right(394, y - 20, String(item.quantity), 8); page.right(474, y - 20, money(data.currency, item.unitPrice), 8); page.right(544, y - 20, money(data.currency, item.lineTotal), 8, true); page.line(42, y - 35, 553, y - 35); y -= 36
  }
  if (last) {
    const top = y - 18; const rows = [['Subtotal:', money(data.currency, data.subtotal)], ['Discounts / Coupon:', `-${money(data.currency, data.discount)}`], ['Tax (GST):', money(data.currency, data.tax)], ['Shipping:', money(data.currency, data.shipping)]]
    rows.forEach(([label, value], index) => { page.text(354, top - index * 16, label, 8); page.right(544, top - index * 16, value, 8) })
    page.rect(344, top - 87, 209, 24, [0.99, 0.94, 0.96]); page.text(354, top - 79, 'TOTAL PAID:', 10, true, PINK); page.right(544, top - 79, money(data.currency, data.total), 10, true, PINK)
    page.line(42, 70, 553, 70); page.text(195, 54, `Thank you for shopping with ${data.storeName}!`, 9, true)
  }
  return page.commands.join('\n')
}

function legacy(lines: string[]): ReceiptData {
  return { storeName: lines[0] || 'Ali Baba Signs', storeEmail: '', storePhone: '', storeAddress: '', orderNumber: lines.find((line) => line.startsWith('Order:'))?.slice(6).trim() || 'Receipt', orderDate: '', paymentDate: '', fulfilmentType: '', receiptNumber: '', paymentStatus: 'paid', customerName: '', customerEmail: '', shippingAddress: '', stripePaymentIntentId: 'Not recorded', cardBrand: 'card', cardLast4: '----', currency: 'AUD', items: lines.slice(2).map((name) => ({ name, sku: '', size: '', options: '', quantity: 1, unitPrice: 0, lineTotal: 0 })), subtotal: 0, discount: 0, tax: 0, shipping: 0, total: 0, generatedAt: new Date().toISOString() }
}

export function createReceiptPdf(input: ReceiptData | string[]) {
  const data = Array.isArray(input) ? legacy(input) : input; const pending = [...data.items]; const chunks = [pending.splice(0, 6)]; while (pending.length) chunks.push(pending.splice(0, 10))
  const streams = chunks.map((items, index) => renderPage(data, items, index + 1, chunks.length, index === 0, index === chunks.length - 1)); const pageIds = streams.map((_, index) => 5 + index * 2)
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${streams.length} >>`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>']
  streams.forEach((stream, index) => { objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + index * 2} 0 R >>`); objects.push(`<< /Length ${Buffer.byteLength(stream, 'binary')} >>\nstream\n${stream}\nendstream`) })
  let output = '%PDF-1.4\n% Ali Baba Signs HTML payment receipt design\n'; const offsets = [0]; objects.forEach((object, index) => { offsets.push(Buffer.byteLength(output, 'binary')); output += `${index + 1} 0 obj\n${object}\nendobj\n` }); const xref = Buffer.byteLength(output, 'binary')
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`; return Buffer.from(output, 'binary')
}
