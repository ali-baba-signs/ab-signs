import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createReceiptPdf } from '../lib/pdf/receipt'

async function main() {
const outputDirectory = resolve('tmp', 'receipt-verification')
const output = resolve(outputDirectory, 'sample-receipt.pdf')
await mkdir(outputDirectory, { recursive: true })
await writeFile(output, createReceiptPdf([
  'Alibaba Signs',
  'accounts@alibabasigns.com.au',
  '+61 2 0000 0000',
  'Sydney, NSW, Australia',
  '',
  'PAYMENT RECEIPT',
  'Order: ABS-VERIFY-001',
  'Order date: 2026-08-06T09:00:00.000Z',
  'Receipt generated: 2026-08-06T10:00:00.000Z',
  'Customer: customer@example.com',
  'Billing address: 10 Example Street, Sydney, NSW, 2000, Australia',
  '',
  'ITEMS',
  'Vinyl Banner | 6 x 3 ft | qty 2 | AUD 120.00',
  '',
  'Subtotal: AUD 240.00',
  'Discounts: AUD 0.00',
  'Tax: AUD 24.00',
  'Shipping: AUD 15.00',
  'Total: AUD 279.00',
  'Payment method: card',
  'Payment status: paid',
  'Transaction reference: verify_001',
  'Payment date: 2026-08-06T09:05:00.000Z',
]))
console.log(output)
}

void main()
