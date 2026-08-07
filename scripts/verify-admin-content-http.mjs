import nextEnv from '@next/env'
import pg from 'pg'
import { spawn } from 'node:child_process'
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { hashPassword } from 'better-auth/crypto'

nextEnv.loadEnvConfig(process.cwd())
const required = ['DATABASE_URL', 'CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_R2_BUCKET', 'CLOUDFLARE_R2_ACCESS_KEY_ID', 'CLOUDFLARE_R2_SECRET_ACCESS_KEY']
for (const name of required) if (!process.env[name]) throw new Error(`${name} is required.`)

const marker = crypto.randomUUID()
const adminId = crypto.randomUUID()
const email = `content-verifier-${marker}@invalid.local`
const password = `Verify-${crypto.randomUUID()}!`
const port = process.env.ADMIN_HTTP_VERIFY_PORT || '3102'
const baseURL = `http://127.0.0.1:${port}`
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const r2 = new S3Client({ region: 'auto', endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`, credentials: { accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID, secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY } })
const created = { keys: [], heroId: null, templateId: null, productId: null, categoryId: null }
let server
let cookie = ''

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (server?.exitCode !== null) throw new Error('Next.js test server exited before becoming ready.')
    try { const response = await fetch(`${baseURL}/api/admin-auth/get-session`); if (response.status < 500) return }
    catch {}
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error('Timed out waiting for the built Next.js server.')
}

async function request(path, init = {}) {
  const headers = new Headers(init.headers)
  headers.set('origin', baseURL)
  if (cookie) headers.set('cookie', cookie)
  const response = await fetch(`${baseURL}${path}`, { ...init, headers, redirect: 'manual' })
  const payload = await response.json().catch(() => null)
  return { response, payload }
}

async function json(path, method, body) {
  const result = await request(path, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  if (!result.response.ok) throw new Error(`${method} ${path} failed (${result.response.status}): ${result.payload?.error?.message || result.payload?.message || 'Unknown error'}`)
  return result.payload
}

async function upload(filename, contentType, bytes, purpose, destination) {
  const form = new FormData()
  form.set('file', new File([bytes], filename, { type: contentType }))
  form.set('purpose', purpose)
  form.set('destination', destination)
  const result = await request('/api/admin/uploads', { method: 'POST', body: form })
  if (!result.response.ok) throw new Error(`Upload ${filename} failed (${result.response.status}): ${result.payload?.error?.message || 'Unknown error'}`)
  created.keys.push(result.payload.data.key)
  return result.payload.data
}

try {
  await pool.query('insert into admin_users (id, name, email, "emailVerified", role) values ($1, $2, $3, true, $4)', [adminId, 'Content Verifier', email, 'admin'])
  await pool.query('insert into admin_accounts (id, "accountId", "providerId", "userId", password) values ($1, $2, $3, $4, $5)', [crypto.randomUUID(), adminId, 'credential', adminId, await hashPassword(password)])
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', port], { cwd: process.cwd(), env: { ...process.env, NODE_ENV: 'production' }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
  await waitForServer()
  const login = await request('/api/admin-auth/sign-in/email', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) })
  if (!login.response.ok) throw new Error(`Temporary admin sign-in failed (${login.response.status}): ${login.payload?.message || 'Unknown error'}`)
  cookie = login.response.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ')
  if (!cookie) throw new Error('Admin sign-in did not return a session cookie.')

  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
  const svgMarkup = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 300"><rect width="600" height="300" fill="#ed1b68"/><circle cx="300" cy="150" r="80" fill="white"/></svg>'
  const heroAsset = await upload(`hero-${marker}.png`, 'image/png', png, 'homepage', 'homepage/hero/desktop')
  const previewAsset = await upload(`preview-${marker}.png`, 'image/png', png, 'template', 'design-editor/templates')
  const svgAsset = await upload(`source-${marker}.svg`, 'image/svg+xml', svgMarkup, 'template', 'design-editor/templates')
  const productAsset = await upload(`product-${marker}.png`, 'image/png', png, 'product-image', 'products')

  const registeredAsset = await pool.query('select id, object_key, status from storage_assets where id = $1 and object_key = $2', [productAsset.id, productAsset.key])
  if (registeredAsset.rowCount !== 1 || registeredAsset.rows[0].status !== 'available') throw new Error('New product image was not registered consistently after upload.')
  const legacyDefinition = await upload(`manual-${marker}.json`, 'application/json', '{}', 'template', 'design-editor/templates').then(() => null, (error) => error)
  if (!(legacyDefinition instanceof Error) || !/failed \(400\)/.test(legacyDefinition.message)) throw new Error('Manual JSON template upload was not rejected by the HTTP API.')

  const hero = await json('/api/admin/heroes', 'POST', { desktopAssetId: heroAsset.id, mobileAssetId: '', title: '', description: '', eyebrow: '', buttonLabel: '', buttonUrl: '', altText: 'Image-only verification hero', horizontalAlignment: 'center', verticalAlignment: 'bottom', featured: true, enabled: true, displayOrder: 0 })
  created.heroId = hero.data.hero.id
  await json(`/api/admin/heroes/${created.heroId}`, 'PUT', { desktopAssetId: heroAsset.id, mobileAssetId: '', title: '', description: '', eyebrow: '', buttonLabel: '', buttonUrl: '', altText: 'Image-only verification hero', horizontalAlignment: 'right', verticalAlignment: 'top', featured: false, enabled: false, displayOrder: 2 })

  const category = await json('/api/admin/categories', 'POST', { name: `HTTP Verification ${marker}` })
  created.categoryId = category.data.category.id
  const duplicateCategory = await request('/api/admin/categories', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: `  http   verification ${marker} ` }) })
  if (duplicateCategory.response.status !== 409) throw new Error('Case-insensitive HTTP category duplicate was not rejected.')

  const canvasData = { version: '7.4.0', objects: [{ type: 'rect', version: '7.4.0', originX: 'left', originY: 'top', left: 0, top: 0, width: 600, height: 300, fill: '#ed1b68', stroke: null, strokeWidth: 1, scaleX: 2, scaleY: 2, angle: 0, flipX: false, flipY: false, opacity: 1, visible: true, backgroundColor: '', fillRule: 'nonzero', paintFirst: 'fill', globalCompositeOperation: 'source-over', skewX: 0, skewY: 0 }] }
  const template = await json('/api/admin/templates', 'POST', { name: `HTTP Template ${marker}`, description: 'Temporary end-to-end template', category: 'templates', status: 'active', width: 6, height: 3, unit: 'ft', assets: { previewImage: previewAsset, svg: svgAsset }, svgChecksum: svgAsset.checksum, conversionVersion: 1, canvasData, scaleMetadata: { pixelsPerMm: 0.656, sourceObjectCount: 2 }, sizes: [{ label: '6 x 3 ft', width: 6, height: 3, unit: 'ft', fitMode: 'contain', safeMargin: 0.1, enabled: true, isDefault: true }] })
  created.templateId = template.data.template.id
  const storedTemplate = await request(`/api/admin/templates/${created.templateId}`)
  const inheritedSizeId = storedTemplate.payload?.data?.template?.sizes?.[0]?.id
  if (!storedTemplate.response.ok || !inheritedSizeId) throw new Error('Template-owned size was not persisted.')
  const product = await json('/api/admin/products', 'POST', { sku: `HTTP-${marker}`, name: `HTTP Product ${marker}`, description: '<p>Temporary end-to-end product description.</p>', basePrice: 10, categoryId: created.categoryId, templateId: created.templateId, featured: false, active: true, images: [{ assetId: productAsset.id, key: productAsset.key, url: productAsset.url, alt: 'HTTP product image', isPrimary: true, order: 0 }], sizes: [], templatePrices: [{ templateSizeId: inheritedSizeId, unitPrice: 10, enabled: true }] })
  created.productId = product.data.product.id
  const publicProduct = await request(`/api/products/${created.productId}`)
  const sizeId = publicProduct.payload?.data?.product?.sizes?.[0]?.id
  if (!publicProduct.response.ok || publicProduct.payload.data.product.template?.id !== created.templateId || !sizeId) throw new Error('Public product did not expose its active editable template and size.')
  const editorContext = await request(`/api/templates/${created.templateId}?productId=${created.productId}&sizeId=${sizeId}`)
  if (!editorContext.response.ok || editorContext.payload.data.template.id !== created.templateId || editorContext.payload.data.productConfig.logicalCanvasWidth !== 1200) throw new Error('Public editor context did not resolve the associated template, product, and fixed size.')

  await json(`/api/admin/products/${created.productId}`, 'DELETE', {})
  created.productId = null
  await json(`/api/admin/templates/${created.templateId}`, 'DELETE', {})
  created.templateId = null
  await json(`/api/admin/heroes/${created.heroId}`, 'DELETE', {})
  created.heroId = null
  console.log('Authenticated HTTP verification passed: separate admin sign-in, upload registry consistency, JSON rejection, hero management, custom category duplicate protection, cached SVG template persistence, inherited template-size pricing, product association, and public editor context.')
} finally {
  if (created.productId) await pool.query('delete from products where id = $1', [created.productId]).catch(() => undefined)
  if (created.templateId) await pool.query('delete from templates where id = $1', [created.templateId]).catch(() => undefined)
  if (created.heroId) await pool.query('delete from hero_slides where id = $1', [created.heroId]).catch(() => undefined)
  if (created.categoryId) await pool.query('delete from product_categories where id = $1', [created.categoryId]).catch(() => undefined)
  await pool.query('delete from admin_activity_logs where admin_user_id = $1 or entity_name like $2', [adminId, `%${marker}%`]).catch(() => undefined)
  await pool.query('delete from admin_users where id = $1', [adminId]).catch(() => undefined)
  for (const key of created.keys) await r2.send(new DeleteObjectCommand({ Bucket: process.env.CLOUDFLARE_R2_BUCKET, Key: key })).catch(() => undefined)
  if (created.keys.length) await pool.query('delete from storage_assets where object_key = any($1::text[])', [created.keys]).catch(() => undefined)
  server?.kill()
  r2.destroy()
  await pool.end()
}
