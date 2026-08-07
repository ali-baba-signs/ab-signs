import { loadEnvConfig } from '@next/env'
import './server-only-register.cjs'

async function main() {
  loadEnvConfig(process.cwd())
  const { db } = await import('../lib/db/client')
  const { storageAssets } = await import('../lib/db/schema')
  const { deleteAssetIfOrphaned, listAndReconcileAssets } = await import('../lib/storage/asset-records')
  const { uploadObject } = await import('../lib/storage/r2')
  const { inArray } = await import('drizzle-orm')
  const prefixes = ['homepage', 'products', 'design-editor/templates']
  const existingKeys = new Set<string>()

  for (const prefix of prefixes) {
  let cursor: string | undefined
  do {
    const page = await listAndReconcileAssets({ prefix, limit: 50, continuationToken: cursor })
    for (const object of page.objects) existingKeys.add(object!.key)
    cursor = page.nextContinuationToken || undefined
  } while (cursor)
  }

  if (existingKeys.size) {
  const rows = await db.select({ key: storageAssets.objectKey }).from(storageAssets).where(inArray(storageAssets.objectKey, [...existingKeys]))
  if (rows.length !== existingKeys.size) throw new Error(`Only ${rows.length} of ${existingKeys.size} existing R2 objects were reconciled.`)
  }

  const testPrefix = `site/misc/content-verification-${crypto.randomUUID()}`
  const testKeys = [0, 1, 2].map((index) => `${testPrefix}/page-${index}.png`)
  try {
  for (const key of testKeys) await uploadObject({ key, body: Buffer.from('not-a-real-image'), contentType: 'image/png' })
  const seen = new Set<string>()
  let cursor: string | undefined
  let pageCount = 0
  let signedPreview = ''
  do {
    const page = await listAndReconcileAssets({ prefix: testPrefix, limit: 1, continuationToken: cursor })
    pageCount += 1
    for (const object of page.objects) {
      seen.add(object!.key)
      signedPreview ||= object!.previewUrl
    }
    cursor = page.nextContinuationToken || undefined
  } while (cursor)
  if (seen.size !== testKeys.length || pageCount !== testKeys.length) throw new Error(`Pagination returned ${seen.size} objects across ${pageCount} pages; expected ${testKeys.length}.`)
  const previewResponse = await fetch(signedPreview, { cache: 'no-store' })
  if (!previewResponse.ok) throw new Error(`Signed preview returned HTTP ${previewResponse.status}.`)
  const records = await db.select({ key: storageAssets.objectKey }).from(storageAssets).where(inArray(storageAssets.objectKey, testKeys))
  if (records.length !== testKeys.length) throw new Error('Newly uploaded objects were not reconciled into asset records.')
  console.log(`Content asset verification passed: ${existingKeys.size} existing object(s) reconciled, 3-page R2 pagination, new-object visibility, database records, and signed preview URL.`)
  } finally {
  await Promise.allSettled(testKeys.map(deleteAssetIfOrphaned))
  }

  await (db as unknown as { $client?: { end?: () => Promise<void> } }).$client?.end?.()
}

void main().catch((error) => {
  console.error(`Content asset verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  process.exitCode = 1
})
