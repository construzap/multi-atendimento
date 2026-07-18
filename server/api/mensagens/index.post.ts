import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError, isError, readBody } from 'h3'
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
  workspace_id?: number | string
  /** DDI+DDD+número ou já com `@s.whatsapp.net`. */
  telefone?: string
  /** JID do contato, ex.: `…@lid`. Se vier só dígitos, acrescenta `@lid`. */
  lid?: string
  /** Texto (para `send/text`) ou legenda/descrição (para `send/media`). */
  conteudo?: string
  temp_id?: string
  /**
   * `conversas.key` da conversa aberta no app — lookup por canal + phone/lid em persistência.
   */
  conversa_sessao?: string

  /** Envio de mídia (Uazapi `send/media`). */
  media_type?: 'image' | 'video' | 'document' | 'audio' | 'ptt'
  /** URL pública do arquivo (ex.: B2 público). */
  media_file?: string
  /** ID da mensagem citada (reply) na Uazapi. */
  replyid?: string
}

/** Extrai `messageid` da resposta Uazapi (`messageid` ou sufixo de `id`). */
function extractUazapiMessageId(res: Record<string, unknown>): string {
  const rawMessageId = res.messageid
  if (typeof rawMessageId === 'string' && rawMessageId.trim()) {
    return rawMessageId.trim()
  }
  if (typeof rawMessageId === 'number' && Number.isFinite(rawMessageId)) {
    return String(Math.trunc(rawMessageId))
  }

  const rawId = res.id
  if (typeof rawId === 'string' && rawId.trim()) {
    const id = rawId.trim()
    const colon = id.lastIndexOf(':')
    if (colon >= 0 && colon < id.length - 1) {
      return id.slice(colon + 1).trim()
    }
    return id
  }

  return ''
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

/** JID `@lid` para o campo `number` da Uazapi. */
function normalizeLidForUazapi(raw: string): string {
  const s = String(raw ?? '').trim()
  if (!s) return ''
  if (s.includes('@')) return s
  const digits = s.replace(/\D/g, '')
  if (!digits) return ''
  return `${digits}@lid`
}

/**
 * Ambos informados → usa **LID** (telefone em `conversas.phone` pode estar errado com vários canais).
 * Só telefone → usa telefone.
 * Só LID → usa LID.
 */
function resolveUazapiNumber(telRaw: string, lidRaw: string): {
  number: string
  enviouPorPhone: boolean
  lidNormalizado: string | null
} {
  const tel = telRaw.trim()
  const lidIn = lidRaw.trim()

  if (lidIn) {
    const number = normalizeLidForUazapi(lidIn)
    if (!number) {
      throw createError({ statusCode: 400, statusMessage: 'lid inválido.' })
    }
    return { number, enviouPorPhone: false, lidNormalizado: number }
  }

  if (tel) {
    const number = normalizeUazapiNumber(tel)
    if (!number) {
      throw createError({ statusCode: 400, statusMessage: 'telefone inválido.' })
    }
    return { number, enviouPorPhone: true, lidNormalizado: null }
  }

  throw createError({
    statusCode: 400,
    statusMessage: 'Informe telefone ou lid para envio.',
  })
}

/** Erros do `$fetch` não são `H3Error`; não usar só `statusCode` para decidir relançar. */
function mensagemErroUazapiFetch(err: unknown): string {
  const e = err as {
    data?: unknown
    message?: string
    statusMessage?: string
    statusCode?: number
  }
  const d = e?.data
  if (d && typeof d === 'object') {
    const o = d as Record<string, unknown>
    if (typeof o.error === 'string' && o.error.trim()) return o.error.trim()
    if (typeof o.message === 'string' && o.message.trim()) return o.message.trim()
    if (typeof o.msg === 'string' && o.msg.trim()) return o.msg.trim()
  }
  const base = (e?.statusMessage ?? e?.message ?? '').trim()
  if (base) return base
  const code = e?.statusCode
  if (typeof code === 'number' && code >= 500) {
    return 'A Uazapi retornou erro ao enviar (serviço indisponível ou falha temporária). Tente de novo em instantes.'
  }
  return 'Falha ao enviar mensagem pela Uazapi.'
}

/**
 * POST /api/mensagens
 * Envia texto via Uazapi: `{servidor}/send/text` com header `token`.
 *
 * Body:
 * - `id_canal` (obrigatório)
 * - `telefone` e/ou `lid` — obrigatório pelo menos um; se ambos, usa **LID** na Uazapi
 * - `conteudo` (obrigatório para texto; mídia pode ser vazio com legenda opcional)
 * - `conversa_sessao`: `conversas.key` da conversa aberta (lookup persistência / foto)
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

  const rawWs = body.workspace_id
  if (rawWs === undefined || rawWs === null || rawWs === '') {
    throw createError({ statusCode: 400, statusMessage: 'Informe workspace_id no body.' })
  }
  const workspaceId = typeof rawWs === 'number' ? rawWs : Number.parseInt(String(rawWs), 10)
  if (!Number.isFinite(workspaceId) || !Number.isInteger(workspaceId) || workspaceId < 1) {
    throw createError({ statusCode: 400, statusMessage: 'workspace_id inválido.' })
  }

  const telefoneRaw =
    typeof body.telefone === 'string' ? body.telefone.trim() : String(body.telefone ?? '').trim()
  const lidBodyRaw = typeof body.lid === 'string' ? body.lid.trim() : String(body.lid ?? '').trim()

  const { number: numero, enviouPorPhone, lidNormalizado } = resolveUazapiNumber(
    telefoneRaw,
    lidBodyRaw,
  )

  const conteudo = typeof body.conteudo === 'string' ? body.conteudo.trim() : ''

  const mediaType = body.media_type
  const mediaFile = typeof body.media_file === 'string' ? body.media_file.trim() : ''
  const isMedia = Boolean(mediaType && mediaFile)
  if (!isMedia && !conteudo) {
    throw createError({ statusCode: 400, statusMessage: 'Informe conteudo.' })
  }

  const tempId = typeof body.temp_id === 'string' && body.temp_id.trim() ? body.temp_id.trim() : null

  const replyid =
    typeof body.replyid === 'string' && body.replyid.trim() ? body.replyid.trim() : null

  const isOwner = await checkChannel(event, canalId, userId)
  if (!isOwner) {
    throw createError({ statusCode: 403, statusMessage: 'Você não tem permissão para acessar este canal.' })
  }

  const sub = await checkSubscription(event, workspaceId)
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

  /** Destino efetivo na Uazapi (pode mudar para `@lid` após fallback). */
  let numeroEnvio = numero
  let enviouPorPhoneEfetivo = enviouPorPhone
  /** Para persistência quando o envio foi por LID (inclui fallback). */
  let lidResolvedParaPersist: string | null = lidNormalizado

  try {
    const replyFields = replyid ? { replyid } : {}

    const bodyPrimario = isMedia
      ? {
          number: numeroEnvio,
          type: mediaType,
          file: mediaFile,
          text: conteudo || undefined,
          ...replyFields,
        }
      : {
          number: numeroEnvio,
          text: conteudo,
          ...replyFields,
        }

    let res: any
    try {
      res = await $fetch<any>(url, {
        method: 'POST',
        headers: { token },
        body: bodyPrimario,
      })
    } catch (firstErr: unknown) {
      if (isError(firstErr)) throw firstErr

      const jidLidFallback = normalizeLidForUazapi(lidBodyRaw)
      const podeFallbackPorLid =
        Boolean(telefoneRaw && lidBodyRaw && enviouPorPhoneEfetivo && jidLidFallback)

      if (!podeFallbackPorLid) {
        throw createError({
          statusCode: 502,
          statusMessage: mensagemErroUazapiFetch(firstErr),
        })
      }

      try {
        res = await $fetch<any>(url, {
          method: 'POST',
          headers: { token },
          body: isMedia
            ? {
                number: jidLidFallback,
                type: mediaType,
                file: mediaFile,
                text: conteudo || undefined,
                ...replyFields,
              }
            : {
                number: jidLidFallback,
                text: conteudo,
                ...replyFields,
              },
        })
        numeroEnvio = jidLidFallback
        enviouPorPhoneEfetivo = false
        lidResolvedParaPersist = jidLidFallback
      } catch (secondErr: unknown) {
        if (isError(secondErr)) throw secondErr
        throw createError({
          statusCode: 502,
          statusMessage: mensagemErroUazapiFetch(secondErr),
        })
      }
    }

    const pnLocal =
      enviouPorPhoneEfetivo && numeroEnvio.includes('@s.whatsapp.net')
        ? (numeroEnvio.split('@')[0] ?? '')
        : ''
    const sessaoRaw = typeof body.conversa_sessao === 'string' ? body.conversa_sessao.trim() : ''

    let lidHint: string | null = null
    let phoneFromConv: string | null = null
    let photoExisting: string | null = null
    if (sessaoRaw) {
      const { data: convRow } = await admin
        .from('conversas')
        .select('lid, phone, photo')
        .eq('key', sessaoRaw)
        .is('deleted_at', null)
        .maybeSingle()
      if (convRow && typeof convRow === 'object') {
        lidHint =
          convRow.lid != null && typeof convRow.lid === 'string' && convRow.lid.trim()
            ? convRow.lid.trim()
            : null
        phoneFromConv =
          convRow.phone != null && typeof convRow.phone === 'string' && convRow.phone.trim()
            ? convRow.phone.trim()
            : null
        photoExisting =
          convRow.photo != null && typeof convRow.photo === 'string' ? convRow.photo : null
      }
    }

    const lidParaPersist = enviouPorPhoneEfetivo
      ? lidHint
      : (lidHint ?? lidResolvedParaPersist)
    const phoneParaPersist =
      phoneFromConv ??
      (enviouPorPhoneEfetivo ? pnLocal || null : null) ??
      (telefoneRaw ? normalizeWhatsappBr(telefoneRaw.replace(/\D/g, '')) : null)

    const message_id = extractUazapiMessageId((res ?? {}) as Record<string, unknown>)
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
            : mediaType === 'audio' || mediaType === 'ptt'
              ? ('audioMessage' as const)
              : ('documentMessage' as const)

    let replyidValido: string | null = null
    if (replyid) {
      const { data: replyRow } = await admin
        .from('mensagens')
        .select('message_id')
        .eq('message_id', replyid)
        .maybeSingle()
      if (replyRow && typeof replyRow === 'object') {
        replyidValido = replyid
      }
    }

    const normalizada: MensagemNormalizada = {
      message_id,
      from_me: true,
      message: messageText || null,
      phone: phoneParaPersist,
      lid: lidParaPersist,
      connected_phone: '',
      messagetype,
      from_api: true,
      id_canal: canalId,
      workspace_id: workspaceId,
      media_url,
      caption: isMedia && messageText ? messageText : null,
      filename: null,
      name: null,
      photo: photoExisting,
      message_timestamp: tsMs,
      is_group: false,
      id_group: null,
      name_group: null,
      ...(replyidValido ? { replyid: replyidValido } : {}),
    }

    const saved = await persistWebhookMensagem(admin, normalizada, {
      conversa_key_hint: sessaoRaw || null,
    })
    if (!saved.ok) {
      throw createError({
        statusCode: 500,
        statusMessage: `Falha ao salvar (${saved.step}): ${saved.message}`,
      })
    }

    const conversa_key = saved.conversa_key

    const { data: mensagemSalva, error: mensagemSalvaErr } = await admin
      .from('mensagens')
      .select('message_id, key_conversa, id_canal')
      .eq('message_id', message_id)
      .eq('id_canal', canalId)
      .maybeSingle()

    if (mensagemSalvaErr) {
      throw createError({ statusCode: 500, statusMessage: mensagemSalvaErr.message })
    }

    const keyCorreta = conversa_key?.trim() || ''
    const precisaGravarMensagem =
      !mensagemSalva ||
      !keyCorreta ||
      mensagemSalva.key_conversa?.trim() !== keyCorreta

    if (precisaGravarMensagem) {
      const { error: insertMsgErr } = await admin.from('mensagens').upsert(
        {
          message_id,
          created_at: createdAt,
          from_me: true,
          message: messageText || null,
          phone: phoneParaPersist,
          lid: lidParaPersist,
          connected_phone: null,
          messagetype,
          from_api: true,
          id_canal: canalId,
          media_url,
          caption: isMedia && messageText ? messageText : null,
          filename: null,
          key_conversa: keyCorreta,
          ...(replyidValido ? { replyid: replyidValido } : {}),
        },
        { onConflict: 'message_id,id_canal' },
      )

      if (insertMsgErr) {
        throw createError({
          statusCode: 500,
          statusMessage: `Falha ao salvar mensagem: ${insertMsgErr.message}`,
        })
      }
    }

    let mensagemCitada: MensagemShape | null = null
    if (replyidValido) {
      const { data: citadaRow } = await admin
        .from('mensagens')
        .select(
          'message_id, created_at, from_me, message, phone, lid, connected_phone, messagetype, from_api, id_canal, media_url, caption, filename, key_conversa, name, replyid',
        )
        .eq('message_id', replyidValido)
        .maybeSingle()
      if (citadaRow && typeof citadaRow === 'object') {
        const row = citadaRow as Record<string, unknown>
        mensagemCitada = {
          key_conversa: typeof row.key_conversa === 'string' ? row.key_conversa : conversa_key,
          message_id: String(row.message_id ?? replyidValido),
          created_at:
            typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
          from_me: row.from_me === true,
          message: typeof row.message === 'string' ? row.message : null,
          phone: typeof row.phone === 'string' ? row.phone : phoneParaPersist,
          lid: typeof row.lid === 'string' ? row.lid : lidParaPersist,
          connected_phone:
            typeof row.connected_phone === 'string' ? row.connected_phone : null,
          messagetype: (row.messagetype as MensagemShape['messagetype']) ?? 'conversation',
          from_api: row.from_api === true,
          id_canal: typeof row.id_canal === 'number' ? row.id_canal : canalId,
          media_url: typeof row.media_url === 'string' ? row.media_url : null,
          caption: typeof row.caption === 'string' ? row.caption : null,
          filename: typeof row.filename === 'string' ? row.filename : null,
          name: typeof row.name === 'string' ? row.name : null,
          photo: photoExisting,
        }
      }
    }

    const mensagem: MensagemShape = {
      key_conversa: conversa_key,
      temp_id: tempId,
      message_id,
      created_at: createdAt,
      from_me: true,
      message: messageText || null,
      phone: phoneParaPersist,
      lid: lidParaPersist,
      connected_phone: null,
      messagetype,
      from_api: true,
      id_canal: canalId,
      media_url,
      caption: isMedia && messageText ? messageText : null,
      filename: null,
      name: null,
      photo: photoExisting,
      ...(replyidValido ? { replyid: replyidValido } : {}),
      ...(mensagemCitada ? { mensagem_citada: mensagemCitada } : {}),
    }

    const payload: PusherNovaMensagemPayload = {
      conversa_key,
      mensagem,
      conversa_name: saved.conversa_name ?? null,
    }
    await triggerNovaMensagem(event, canalId, payload)

    return res
  } catch (err: unknown) {
    if (isError(err)) throw err

    throw createError({
      statusCode: 502,
      statusMessage: mensagemErroUazapiFetch(err),
    })
  }
})

