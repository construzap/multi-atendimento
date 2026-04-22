/**
 * Baixa o binário da mídia via uazapi `POST /message/download`.
 * Usa base64 para não depender do `fileURL` temporário (2 dias).
 */

type DownloadResponse = {
  fileURL?: string
  mimetype?: string
  base64Data?: string
  transcription?: string
  error?: string
}

export async function downloadUazapiMedia(
  baseUrl: string,
  token: string,
  messageid: string,
  isAudio: boolean,
): Promise<{ buffer: Buffer; mimetype: string } | null> {
  const base = String(baseUrl ?? '').trim().replace(/\/+$/, '')
  const tok = String(token ?? '').trim()
  if (!base || !tok || !messageid) {
    return null
  }

  const url = `${base}/message/download`

  const body: Record<string, unknown> = {
    id: messageid,
    return_base64: true,
    return_link: false,
    generate_mp3: isAudio,
  }

  let data: DownloadResponse
  try {
    data = await $fetch<DownloadResponse>(url, {
      method: 'POST',
      headers: {
        token: tok,
        'Content-Type': 'application/json',
      },
      body,
    })
  } catch (err: unknown) {
    const msg = err && typeof err === 'object' && 'data' in err
      ? JSON.stringify((err as { data?: unknown }).data)
      : String(err)
    console.error('[downloadUazapiMedia] falha:', msg)
    return null
  }

  if (data?.error) {
    console.warn('[downloadUazapiMedia] API:', data.error)
    return null
  }

  const b64 = data?.base64Data
  if (!b64 || typeof b64 !== 'string') {
    return null
  }

  const mimetype =
    typeof data.mimetype === 'string' && data.mimetype.trim()
      ? (data.mimetype.split(';')[0] ?? data.mimetype).trim()
      : 'application/octet-stream'

  return {
    buffer: Buffer.from(b64, 'base64'),
    mimetype,
  }
}
