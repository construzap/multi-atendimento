import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError, readBody } from 'h3'
import type { MensagemNormalizada } from '#shared/types/webhook'
import { checkChannel } from '../../utils/checkChannel'
import { checkSubscription } from '../../utils/checkSubscription'
import { getAuthUserId } from '../../utils/getAuthUserId'
import { normalizeWhatsappBr } from '#shared/utils/normalizeWhatsappBr'
import { persistWebhookMensagem } from '../../utils/persistWebhookMensagem'
import { triggerNovaMensagem } from '../../utils/pusherServer'
import type { PusherNovaMensagemPayload, Mensagem as MensagemShape } from '#shared/types/mensagem'

/** Webhook / Uazapi costumam mandar timestamp em segundos; em ms se > 1e12. */
function uazapiTimestampToMs(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return Date.now()
  return raw > 1e12 ? raw : raw * 1000
}

type Body = {
  id_canal?: number | string
  telefone?: string
  /** Texto (para `send/text`) ou legenda/descrição (para `send/media`). */
  conteudo?: string
  temp_id?: string
  /**
   * Sufixo da conversa na UI / Pinia (mesmo valor que `conversaAtual`, ex.: LID).
   * O `telefone` pode ser o PN (`...@s.whatsapp.net`) para a Uazapi; sem isso o Pusher
   * montava `conversa_key` só com o PN e duplicava o bucket (`12-lid` vs `12-phone`).
   */
  conversa_sessao?: string

  /** Envio de mídia (Uazapi `send/media`). */
  media_type?: 'image' | 'video' | 'document' | 'audio'
  /** URL pública do arquivo (ex.: B2 público). */
  media_file?: string
}

function normalizeStatus(s: string) {
  return s.trim().toLowerCase()
}

function normalizeUazapiNumber(raw: string): string {
  const s = String(raw ?? '').trim()
  if (!s) return ''

  // Se já vier no formato esperado pela Uazapi (ex.: "...@newsletter" ou "...@s.whatsapp.net"), mantém.
  if (s.includes('@')) return s

  const digits = s.replace(/\D/g, '')
  if (!digits) return ''

  const normalized = normalizeWhatsappBr(digits)
  return `${normalized}@s.whatsapp.net`
}

/**
 * POST /api/mensagens
 * Envia texto via Uazapi: `{servidor}/send/text` com header `token`.
 *
 * Body:
 * - `id_canal` (obrigatório)
 * - `telefone` (obrigatório) — pode ser dígitos (DDI+DDD+num) ou já vir com sufixo `@...`
 * - `conteudo` (obrigatório)
 * - `conversa_sessao` (recomendado): identificador da conversa no app — igual ao usado no GET mensagens / lista (ex.: LID); alinha Pusher com o cache otimista.
 *
 * Verificações:
 * - Autenticação
 * - Posse do canal (checkChannel)
 * - Assinatura: permite `ativa`/`vencida`/`trial`; bloqueia `pendente`/`cancelado`
 */
export default defineEventHandler(async (event) => {
  const client = await serverSupabaseClient(event)
  const { data: authData, error: authError } = await client.auth.getUser()

  if (authError || !authData.user) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const userId = getAuthUserId(authData.user)
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const body = (await readBody<Body>(event)) ?? {}

  const rawCanal = body.id_canal
  if (rawCanal === undefined || rawCanal === null || rawCanal === '') {
    throw createError({ statusCode: 400, statusMessage: 'Informe id_canal no body.' })
  }
  const canalId = typeof rawCanal === 'number' ? rawCanal : Number.parseInt(String(rawCanal), 10)
  if (!Number.isFinite(canalId) || !Number.isInteger(canalId)) {
    throw createError({ statusCode: 400, statusMessage: 'id_canal inválido.' })
  }

  const telefoneRaw = typeof body.telefone === 'string' ? body.telefone : String(body.telefone ?? '')
  const numero = normalizeUazapiNumber(telefoneRaw)
  if (!numero) {
    throw createError({ statusCode: 400, statusMessage: 'Informe telefone válido.' })
  }

  const conteudo = typeof body.conteudo === 'string' ? body.conteudo.trim() : ''

  const mediaType = body.media_type
  const mediaFile = typeof body.media_file === 'string' ? body.media_file.trim() : ''
  const isMedia = Boolean(mediaType && mediaFile)
  if (!isMedia && !conteudo) {
    throw createError({ statusCode: 400, statusMessage: 'Informe conteudo.' })
  }

  const tempId = typeof body.temp_id === 'string' && body.temp_id.trim() ? body.temp_id.trim() : null

  const isOwner = await checkChannel(event, canalId, userId)
  if (!isOwner) {
    throw createError({ statusCode: 403, statusMessage: 'Você não tem permissão para acessar este canal.' })
  }

  const sub = await checkSubscription(event)
  const statusAssinatura = normalizeStatus(sub.status_assinatura)
  if (statusAssinatura === 'cancelado' || statusAssinatura === 'pendente') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Sua assinatura não está ativa. Regularize seu plano para enviar mensagens.'
    })
  }

  // Busca token/servidor apenas pelo id (sem filtrar por user_id) — posse já validada acima.
  const admin = serverSupabaseServiceRole<any>(event)
  const { data: canalRow, error: canalErr } = await admin
    .from('canais')
    .select('token, servidor')
    .eq('id', canalId)
    .maybeSingle()

  if (canalErr) throw createError({ statusCode: 500, statusMessage: canalErr.message })
  if (!canalRow) throw createError({ statusCode: 404, statusMessage: 'Canal não encontrado.' })

  const token = typeof canalRow?.token === 'string' ? canalRow.token.trim() : ''
  const servidor = typeof canalRow?.servidor === 'string' ? canalRow.servidor.trim() : ''
  if (!token || !servidor) {
    throw createError({ statusCode: 400, statusMessage: 'Canal não possui token/servidor configurados.' })
  }

  const url = `${servidor.replace(/\/+$/, '')}${isMedia ? '/send/media' : '/send/text'}`

  try {
    const res = await $fetch<any>(url, {
      method: 'POST',
      headers: { token },
      body: isMedia
        ? {
            number: numero,
            type: mediaType,
            file: mediaFile,
            text: conteudo || undefined,
          }
        : {
            number: numero,
            text: conteudo,
          },
    })

    const pnLocal = numero.split('@')[0] ?? ''
    const sessaoRaw = typeof body.conversa_sessao === 'string' ? body.conversa_sessao.trim() : ''
    const lidSessao = sessaoRaw || pnLocal
    const conversa_key = `${canalId}-${lidSessao || pnLocal}`

    const messageIdRaw = res?.messageid
    const message_id =
      typeof messageIdRaw === 'string' && messageIdRaw.trim()
        ? messageIdRaw.trim()
        : String(messageIdRaw ?? '').trim()
    if (!message_id) {
      throw createError({ statusCode: 502, statusMessage: 'Resposta da Uazapi sem messageid.' })
    }

    const messageText = typeof res?.text === 'string' ? res.text : conteudo
    const tsMs = uazapiTimestampToMs(res?.messageTimestamp)
    const createdAt = new Date(tsMs).toISOString()

    // Para mídia, tenta usar o link retornado; fallback para o file enviado.
    const fileUrlFromRes =
      (typeof res?.response?.fileUrl === 'string' && res.response.fileUrl.trim()) ||
      (typeof res?.fileURL === 'string' && res.fileURL.trim()) ||
      ''
    const media_url = isMedia ? (fileUrlFromRes || mediaFile || null) : null

    const messagetype =
      !isMedia
        ? ('conversation' as const)
        : mediaType === 'image'
          ? ('imageMessage' as const)
          : mediaType === 'video'
            ? ('videoMessage' as const)
            : mediaType === 'audio'
              ? ('audioMessage' as const)
              : ('documentMessage' as const)

    const { data: convExisting } = await admin
      .from('conversas')
      .select('photo')
      .eq('key', conversa_key)
      .maybeSingle()
    const photoExisting =
      convExisting && typeof convExisting === 'object' && 'photo' in convExisting
        ? (convExisting as { photo: string | null }).photo
        : null

    const normalizada: MensagemNormalizada = {
      conversa_key,
      message_id,
      from_me: true,
      message: messageText || null,
      phone: pnLocal || null,
      lid: lidSessao || null,
      connected_phone: '',
      messagetype,
      from_api: true,
      id_canal: canalId,
      media_url,
      caption: isMedia && messageText ? messageText : null,
      filename: null,
      name: null,
      photo: photoExisting,
      message_timestamp: tsMs,
    }

    const saved = await persistWebhookMensagem(admin, normalizada)
    if (!saved.ok) {
      throw createError({
        statusCode: 500,
        statusMessage: `Falha ao salvar (${saved.step}): ${saved.message}`,
      })
    }

    const mensagem: MensagemShape = {
      temp_id: tempId,
      message_id,
      created_at: createdAt,
      from_me: true,
      message: messageText || null,
      phone: pnLocal || null,
      lid: lidSessao || null,
      connected_phone: null,
      messagetype,
      from_api: true,
      id_canal: canalId,
      media_url,
      caption: isMedia && messageText ? messageText : null,
      filename: null,
      name: null,
      photo: photoExisting,
    }

    const payload: PusherNovaMensagemPayload = {
      conversa_key,
      mensagem,
    }
    await triggerNovaMensagem(event, canalId, payload)

    return res
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'statusCode' in err) throw err

    const maybe = err as { data?: unknown; message?: string }
    const data = maybe?.data
    const apiErr =
      data && typeof data === 'object' && 'error' in (data as any) ? String((data as any).error ?? '') : ''

    throw createError({
      statusCode: 502,
      statusMessage: apiErr.trim() || maybe?.message || 'Falha ao enviar mensagem.'
    })
  }
})

