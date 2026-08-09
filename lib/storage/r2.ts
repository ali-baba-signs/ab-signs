import 'server-only'

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  type PutObjectCommandInput,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export class R2ConfigurationError extends Error {
  code = 'R2_NOT_CONFIGURED'
}

function getR2Config() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  const bucket = process.env.CLOUDFLARE_R2_BUCKET
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY

  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) {
    throw new R2ConfigurationError('Cloudflare R2 is not configured.')
  }

  return { accountId, bucket, accessKeyId, secretAccessKey }
}

let client: S3Client | undefined

function getClient() {
  const config = getR2Config()
  client ??= new S3Client({
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  })
  return { client, bucket: config.bucket }
}

export async function uploadObject(input: {
  key: string
  body: PutObjectCommandInput['Body']
  contentType: string
  metadata?: Record<string, string>
}) {
  const { client: r2, bucket } = getClient()
  await r2.send(new PutObjectCommand({
    Bucket: bucket,
    Key: input.key,
    Body: input.body,
    ContentType: input.contentType,
    Metadata: input.metadata,
  }))
  return { key: input.key }
}

export async function deleteObject(key: string) {
  const { client: r2, bucket } = getClient()
  await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
}

export async function objectExists(key: string) {
  try {
    await getObjectMetadata(key)
    return true
  } catch (error) {
    if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) return false
    throw error
  }
}

export async function getObjectMetadata(key: string) {
  const { client: r2, bucket } = getClient()
  return r2.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
}

export async function getObjectBody(key: string) {
  const { client: r2, bucket } = getClient()
  const result = await r2.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
  if (!result.Body) throw new Error('Storage returned an empty object.')
  return Buffer.from(await result.Body.transformToByteArray())
}

export async function listObjects(input: { prefix: string; maxKeys?: number; continuationToken?: string }) {
  const { client: r2, bucket } = getClient()
  const result = await r2.send(new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: input.prefix,
    MaxKeys: Math.min(Math.max(input.maxKeys ?? 100, 1), 500),
    ContinuationToken: input.continuationToken,
  }))
  return {
    objects: (result.Contents ?? []).map((object) => ({
      key: object.Key ?? '',
      size: object.Size ?? 0,
      etag: object.ETag?.replace(/^"|"$/g, '') ?? null,
      updatedAt: object.LastModified?.toISOString() ?? null,
    })),
    nextContinuationToken: result.NextContinuationToken ?? null,
    isTruncated: Boolean(result.IsTruncated),
  }
}

export async function createPresignedDownloadUrl(key: string, expiresIn = 300) {
  const { client: r2, bucket } = getClient()
  return getSignedUrl(r2, new GetObjectCommand({ Bucket: bucket, Key: key }), {
    expiresIn: Math.min(Math.max(expiresIn, 60), 900),
  })
}

export async function createPresignedUploadUrl(input: {
  key: string
  contentType: string
  expiresIn?: number
}) {
  const { client: r2, bucket } = getClient()
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: input.key,
    ContentType: input.contentType,
  })
  return getSignedUrl(r2, command, { expiresIn: Math.min(input.expiresIn ?? 300, 600) })
}
