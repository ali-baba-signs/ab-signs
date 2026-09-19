import nextEnv from '@next/env'
import pg from 'pg'
nextEnv.loadEnvConfig(process.cwd())
const required = ['DATABASE_URL','BETTER_AUTH_SECRET','BETTER_AUTH_URL','NEXT_PUBLIC_SITE_URL','SMTP_HOST','SMTP_USER','SMTP_PASSWORD','SMTP_FROM_EMAIL','CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_R2_BUCKET','CLOUDFLARE_R2_ACCESS_KEY_ID','CLOUDFLARE_R2_SECRET_ACCESS_KEY','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET']
console.log(JSON.stringify({ missingEnvironment: required.filter((key) => !process.env[key]), stripeMode: process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_') ? 'test' : process.env.STRIPE_SECRET_KEY ? 'live' : 'missing', authHttps: process.env.BETTER_AUTH_URL?.startsWith('https://'), canonicalAssets: process.env.CLOUDFLARE_R2_PUBLIC_URL === 'https://assets.alibabasigns.com.au' }, null, 2))
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 15000, statement_timeout: 15000 })
try {
  const result = await pool.query(`select p.name, ps.id, ps.label, ps.enabled, ps.front_template_id, ps.back_template_id, ps.design_configurations from product_sizes ps join products p on p.id=ps.product_id where p.active order by p.name, ps.sort_order`)
  console.log(JSON.stringify({ enabledSizes: result.rows.filter((row) => row.enabled).length, unassignedSizes: result.rows.filter((row) => row.enabled && !row.front_template_id && !row.design_configurations?.some((config) => config.enabled && (config.singleTemplateId || config.frontTemplateId))).map((row) => ({ product: row.name, size: row.label })) }, null, 2))
  const templates = await pool.query(`select id, name, status, conversion_status, preview_image_url, preview_image_key, template_side from templates`)
  console.log(JSON.stringify({ templateCount: templates.rowCount, legacyPreviewUrls: templates.rows.filter((row) => row.preview_image_url?.includes('.r2.dev')).length }))
  for (const template of templates.rows) {
    const url = template.preview_image_key ? `https://assets.alibabasigns.com.au/${template.preview_image_key}` : template.preview_image_url
    try {
      const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(15000) })
      console.log(JSON.stringify({ template: template.name, publicPreviewStatus: response.status, cors: response.headers.get('access-control-allow-origin') }))
    } catch (error) { console.log(JSON.stringify({ template: template.name, publicPreviewError: error.message })); process.exitCode = 1 }
  }
  const auth = await pool.query(`select count(*)::int as users, count(*) filter (where "twoFactorEnabled" = false)::int as mfa_disabled from users`)
  console.log(JSON.stringify({ auth: auth.rows[0] }))
} catch (error) { console.error(error.message); process.exitCode = 1 } finally { await pool.end() }

