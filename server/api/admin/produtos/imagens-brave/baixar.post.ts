import { assertMethod, createError, readBody } from 'h3'
import { requireAdminUser } from '../../../../utils/adminPrompt'

type Body = {
  url?: unknown
}

const MAX_BYTES = 10 * 1024 * 1024

function urlHttpsPublica(raw: string): URL {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'URL da imagem inválida.' })
  }
  if (parsed.protocol !== 'https:') {
    throw createError({ statusCode: 400, statusMessage: 'A imagem precisa ser uma URL https.' })
  }
  const host = parsed.hostname.toLowerCase()
  const privada =
    host === 'localhost' ||
    host.endsWith('.local') ||
    host === '0.0.0.0' ||
    /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|169\.254\.)/.test(host)
  if (privada) {
    throw createError({ statusCode: 400, statusMessage: 'URL da imagem não permitida.' })
  }
  return parsed
}

function mimePelosBytes(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return 'image/png'
  }
  if (buf.length >= 6 && buf.subarray(0, 6).toString('ascii').startsWith('GIF8')) return 'image/gif'
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp'
  }
  return null
}

/**
 * POST /api/admin/produtos/imagens-brave/baixar
 * Body: `{ url }`
 * Baixa a imagem no servidor para o upload B2 (somente ADMIN).
 */
export default defineEventHandler(async (event): Promise<{ mime: string; data_base64: string }> => {
  assertMethod(event, 'POST')
  await requireAdminUser(event)

  const body = (await readBody<Body>(event).catch(() => null)) ?? {}
  const alvo = urlHttpsPublica(String(body.url ?? '').trim())

  let res: Response
  try {
    res = await fetch(alvo, {
      redirect: 'follow',
      signal: AbortSignal.timeout(20_000),
      headers: {
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0',
      },
    })
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'Não foi possível baixar a imagem.' })
  }

  if (!res.ok) {
    throw createError({
      statusCode: 502,
      statusMessage: `Falha ao baixar a imagem (${res.status}).`,
    })
  }

  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length <= 0 || buf.length > MAX_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Imagem muito grande (máx 10MB).' })
  }

  const mime = mimePelosBytes(buf)
  if (!mime) {
    throw createError({
      statusCode: 400,
      statusMessage: 'O arquivo baixado não é uma imagem jpeg, png, webp ou gif.',
    })
  }

  return { mime, data_base64: buf.toString('base64') }
})
