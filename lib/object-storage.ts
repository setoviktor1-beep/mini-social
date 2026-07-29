import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { SignJWT } from 'jose'

let client: S3Client | undefined

function getClient() {
  if (!client) {
    const endpoint = process.env.S3_ENDPOINT
    const accessKeyId = process.env.S3_ACCESS_KEY
    const secretAccessKey = process.env.S3_SECRET_KEY

    if (!endpoint || !accessKeyId || !secretAccessKey) {
      throw new Error(
        'S3_ENDPOINT, S3_ACCESS_KEY and S3_SECRET_KEY are required',
      )
    }

    client = new S3Client({
      endpoint,
      region: process.env.S3_REGION || 'us-east-1',
      forcePathStyle: true,
      credentials: { accessKeyId, secretAccessKey },
    })
  }

  return client
}

function validateObjectKey(key: string) {
  if (
    !key ||
    key.startsWith('/') ||
    key.includes('..') ||
    key.includes('\\')
  ) {
    throw new Error('Invalid object key')
  }
}

export function getPublicObjectUrl(bucket: string, key: string) {
  validateObjectKey(key)
  const baseURL = process.env.S3_PUBLIC_URL
  if (!baseURL) throw new Error('S3_PUBLIC_URL is required')
  return `${baseURL.replace(/\/$/, '')}/${bucket}/${encodeURI(key)}`
}

export async function createUploadUrl(
  bucket: string,
  key: string,
  contentType: string,
) {
  validateObjectKey(key)
  return getSignedUrl(
    getClient(),
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: 300 },
  )
}

export async function uploadObject(
  bucket: string,
  key: string,
  body: Uint8Array | Buffer,
  contentType: string,
) {
  validateObjectKey(key)
  await getClient().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  )
  return { path: key }
}

export async function createDownloadUrl(bucket: string, key: string) {
  validateObjectKey(key)
  const secret = process.env.BETTER_AUTH_SECRET
  const baseURL = process.env.APP_URL || process.env.BETTER_AUTH_URL
  if (!secret || !baseURL) throw new Error('Storage signing is not configured')
  const token = await new SignJWT({ bucket, key })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('5m')
    .sign(new TextEncoder().encode(secret))
  return `${baseURL.replace(/\/$/, '')}/api/storage/file?token=${encodeURIComponent(token)}`
}

export async function deleteObject(bucket: string, key: string) {
  validateObjectKey(key)
  await getClient().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
}

export async function getObject(bucket: string, key: string) {
  validateObjectKey(key)
  return getClient().send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  )
}
