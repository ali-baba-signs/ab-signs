import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createReceiptPdf } from '../lib/pdf/receipt'

async function main() {
const outputDirectory = resolve('tmp', 'pdfs')
const output = resolve(outputDirectory, 'sample-receipt.pdf')
await mkdir(outputDirectory, { recursive: true })
await writeFile(output, createReceiptPdf({
  storeName: 'Ali Baba Signs', storeEmail: 'sales@alibabasigns.com.au', storePhone: '04 33 88 55 79', storeAddress: 'Southern River, Western Australia',
  orderNumber: 'ABS-VERIFY-001', orderDate: '21/08/2026, 9:00 am', paymentDate: '21/08/2026, 9:05 am', fulfilmentType: 'Delivery', receiptNumber: 'receipt_verify_001', paymentStatus: 'paid',
  customerName: 'Test Customer', customerEmail: 'customer@example.com', shippingAddress: '10 Example Street, Perth, WA, 6000, Australia',
  stripePaymentIntentId: 'pi_3VerifyAliBabaSigns', cardBrand: 'visa', cardLast4: '4242', currency: 'AUD',
  items: [{ name: 'Vinyl Banner', sku: 'VB-6X3', size: '6 x 3 ft', options: 'Single-sided / design assistance', quantity: 2, unitPrice: 120, lineTotal: 240 }],
  subtotal: 240, discount: 20, tax: 22, shipping: 15, total: 257, generatedAt: '21/08/2026, 9:05 am',
}))
console.log(output)
}

void main()
