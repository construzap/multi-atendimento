import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

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
): Promise<string> {
  const config = useRuntimeConfig()
  const bucket = String(config.b2BucketName ?? '').trim()
  if (!bucket) {
    throw new Error('NUXT_B2_BUCKET_NAME não configurado.')
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
