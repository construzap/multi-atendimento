import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

let s3Client: S3Client | null = null
let cachedCredsSig = ''

function getB2Client(): S3Client {
  const config = useRuntimeConfig()
  const endpoint = String(config.b2Endpoint ?? '').trim().replace(/\/+$/, '')
  const region = String(config.b2Region ?? '').trim()
  const keyId = String(config.b2KeyId ?? '').trim()
  const appKey = String(config.b2AppKey ?? '').trim()

  if (!endpoint || !region || !keyId || !appKey) {
    throw new Error('Credenciais Backblaze B2 ausentes (NUXT_B2_* no .env). Reinicie o dev server após editar o .env.')
  }

  const sig = `${endpoint}|${region}|${keyId.length}|${appKey.length}`
  if (!s3Client || cachedCredsSig !== sig) {
    cachedCredsSig = sig
    s3Client = new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId: keyId,
        secretAccessKey: appKey,
      },
      forcePathStyle: true,
    })
  }
  return s3Client
}

/**
 * Extensão de arquivo a partir do MIME (primeiro segmento, sem parâmetros).
 */
export function mimeToExt(mimetype: string): string {
  const base = (mimetype.split(';')[0] ?? mimetype).trim().toLowerCase()
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'video/mp4': '.mp4',
    'video/quicktime': '.mov',
    'audio/mpeg': '.mp3',
    'audio/mp3': '.mp3',
    'audio/ogg': '.ogg',
    'audio/webm': '.webm',
    'audio/wav': '.wav',
    'audio/x-wav': '.wav',
    'audio/mp4': '.m4a',
    'audio/aac': '.aac',
    'audio/flac': '.flac',
    'application/pdf': '.pdf',
    'text/plain': '.txt',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/msword': '.doc',
  }
  return map[base] ?? '.bin'
}

/**
 * Upload para o bucket público no Backblaze B2 (API S3).
 * @returns URL pública virtual-hosted style.
 */
export async function uploadToB2(
  buffer: Buffer,
  key: string,
  mimeType: string,
  /** Se informado, envia para este bucket em vez de `NUXT_B2_BUCKET_NAME`. */
  bucketOverride?: string,
): Promise<string> {
  const config = useRuntimeConfig()
  const bucket = String((bucketOverride ?? config.b2BucketName) ?? '').trim()
  if (!bucket) {
    throw new Error('Bucket B2 não configurado (NUXT_B2_BUCKET_NAME ou override).')
  }

  const client = getB2Client()
  await client.send(
    new PutObjectCommand({
      Bucket: String(bucket),
      Key: key,
      Body: buffer,
      ContentType: (mimeType.split(';')[0] ?? mimeType).trim(),
    }),
  )

  const region = String(config.b2Region)
  const pathEncoded = key.split('/').map((p) => encodeURIComponent(p)).join('/')
  return `https://${bucket}.s3.${region}.backblazeb2.com/${pathEncoded}`
}

/** Remove objeto do bucket B2 (ignora erro se a chave já não existir). */
export async function deleteFromB2(key: string, bucketOverride?: string): Promise<void> {
  const config = useRuntimeConfig()
  const bucket = String((bucketOverride ?? config.b2BucketName) ?? '').trim()
  if (!bucket) {
    throw new Error('Bucket B2 não configurado (NUXT_B2_BUCKET_NAME ou override).')
  }
  const k = String(key ?? '').trim().replace(/^\/+/, '')
  if (!k) return
  const client = getB2Client()
  try {
    await client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: k,
      }),
    )
  } catch {
    /* objeto pode já ter sido removido */
  }
}
