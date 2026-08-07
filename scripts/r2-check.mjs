import nextEnv from '@next/env'
import {
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { randomUUID } from 'node:crypto'

nextEnv.loadEnvConfig(process.cwd())

const required = [
  'CLOUDFLARE_ACCOUNT_ID',
  'CLOUDFLARE_R2_BUCKET',
  'CLOUDFLARE_R2_ACCESS_KEY_ID',
  'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
]
const missing = required.filter((key) => !process.env[key])
const checkAllPrefixes = process.argv.includes('--all-prefixes')
const checkPublicURL = process.argv.includes('--public')
const checkWrite = process.argv.includes('--write') || checkAllPrefixes || checkPublicURL

const publicSmokePrefixes = [
  'homepage/hero/desktop',
  'homepage/hero/mobile',
  'homepage/categories',
  'homepage/promotions/desktop',
  'homepage/promotions/mobile',
  'homepage/products',
  'products/smoke-test',
  'design-editor/templates/vinyl-banners/previews',
  'design-editor/templates/vinyl-banners/json',
  'design-editor/templates/vinyl-banners/assets',
  'design-editor/graphics/icons',
  'design-editor/backgrounds',
  'site/misc',
]

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

if (missing.length) {
  console.error(`R2 check failed: missing ${missing.join(', ')}`)
  process.exitCode = 1
} else {
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    },
  })

  try {
    const result = await client.send(new ListObjectsV2Command({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET,
      MaxKeys: 1,
    }))
    console.log(`R2 connection OK. Bucket is reachable; object listing is ${result.KeyCount ? 'non-empty' : 'currently empty'}.`)

    const verifyTemporaryObject = async (prefix, verifyPublicRead = false) => {
      const key = `${prefix}/r2-health-check-${randomUUID()}.json`
      let objectCreated = false

      try {
        await client.send(new PutObjectCommand({
          Bucket: process.env.CLOUDFLARE_R2_BUCKET,
          Key: key,
          Body: JSON.stringify({ purpose: 'temporary-r2-health-check' }),
          ContentType: 'application/json',
          CacheControl: 'no-store',
        }))
        objectCreated = true
        await client.send(new HeadObjectCommand({
          Bucket: process.env.CLOUDFLARE_R2_BUCKET,
          Key: key,
        }))

        if (verifyPublicRead) {
          const baseURL = process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL?.replace(/\/+$/, '')
          if (!baseURL) {
            throw new Error('NEXT_PUBLIC_R2_PUBLIC_BASE_URL is required for --public')
          }

          let response
          for (let attempt = 1; attempt <= 5; attempt += 1) {
            response = await fetch(`${baseURL}/${key}`, { cache: 'no-store' })
            if (response.ok) break
            if (attempt < 5) await wait(500)
          }

          if (!response?.ok) {
            throw new Error(`Public URL returned HTTP ${response?.status ?? 'unknown'}`)
          }
          console.log(`Public URL check OK: ${baseURL}/${key}`)
        }

        console.log(`R2 write/read check OK: ${prefix}/`)
      } finally {
        if (objectCreated) {
          await client.send(new DeleteObjectCommand({
            Bucket: process.env.CLOUDFLARE_R2_BUCKET,
            Key: key,
          }))
        }
      }
    }

    if (checkWrite) {
      const prefixes = checkAllPrefixes ? publicSmokePrefixes : ['site/misc']
      for (const prefix of prefixes) {
        await verifyTemporaryObject(prefix, checkPublicURL && prefix === 'site/misc')
      }
      console.log(`${prefixes.length} temporary health-check object(s) removed.`)
    }
  } catch (error) {
    console.error(`R2 connection failed: ${error?.message || error?.name || 'UnknownError'}`)
    process.exitCode = 1
  } finally {
    client.destroy()
  }
}
