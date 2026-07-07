import type { MessageType } from '#shared/types/messageType'
import type { MensagemNormalizada, UazapiMessage, UazapiWebhookPayload } from '#shared/types/webhook'
import { normalizeWhatsappBr } from '#shared/utils/normalizeWhatsappBr'

const MEDIA_MEDIA_TYPES = ['image', 'video', 'ptt', 'audio', 'document', 'sticker'] as const

/** Mensagem de mídia suportada para download + B2 (uazapi `type === 'media'`). */
export function isMediaMessage(msg: UazapiMessage): boolean {
  if (msg.type !== 'media') return false
  return (MEDIA_MEDIA_TYPES as readonly string[]).includes(msg.mediaType)
}

function pickQuotedId(o: Record<string, unknown>): string | null {
  for (const k of ['messageId', 'messageid', 'id', 'stanzaId', 'stanzaID']) {
    const v = o[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return null
}

/** Extrai `message_id` citado (reply) do payload bruto da uazapi. */
export function parseQuotedReplyId(msg: UazapiMessage): string | null {
  const raw = msg.quoted
  if (typeof raw === 'string' && raw.trim()) {
    const s = raw.trim()
    if (s.startsWith('{')) {
      try {
        const o = JSON.parse(s) as Record<string, unknown>
        const id = pickQuotedId(o)
        if (id) return id
      } catch {
        /* texto simples */
      }
    }
    return s
  }
  if (raw && typeof raw === 'object') {
    const id = pickQuotedId(raw as Record<string, unknown>)
    if (id) return id
  }

  const content = msg.content
  if (content && typeof content === 'object') {
    const ci = (content as Record<string, unknown>).contextInfo
    if (ci && typeof ci === 'object') {
      const stanza =
        (ci as Record<string, unknown>).stanzaID ?? (ci as Record<string, unknown>).stanzaId
      if (typeof stanza === 'string' && stanza.trim()) return stanza.trim()

      const quotedMsg = (ci as Record<string, unknown>).quotedMessage
      if (quotedMsg && typeof quotedMsg === 'object') {
        const key = (quotedMsg as Record<string, unknown>).key
        if (key && typeof key === 'object') {
          const id = (key as Record<string, unknown>).id
          if (typeof id === 'string' && id.trim()) return id.trim()
        }
      }
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Helpers de normalização
// ---------------------------------------------------------------------------

/**
 * Preferência: `chat.wa_chatid` / `chat.wa_chatlid` (mais estáveis no payload da uazapi).
 * Fallback: `message.chatid` / `message.chatlid`.
 */
function resolveChatIdentifiers(payload: UazapiWebhookPayload): { chatid: string; chatlid: string } {
  const chat = payload.chat
  const msg = payload.message

  const waCid = chat && typeof chat.wa_chatid === 'string' ? chat.wa_chatid.trim() : ''
  const waLid = chat && typeof chat.wa_chatlid === 'string' ? chat.wa_chatlid.trim() : ''
  const mCid = typeof msg.chatid === 'string' ? msg.chatid.trim() : ''
  const mLid = typeof msg.chatlid === 'string' ? msg.chatlid.trim() : ''

  return {
    chatid: waCid || mCid,
    chatlid: waLid || mLid,
  }
}

/** ID do grupo WhatsApp (ex.: `120363393291103874@g.us`). */
function extractGroupId(...ids: Array<string | undefined | null>): string | null {
  for (const raw of ids) {
    const id = String(raw ?? '').trim()
    if (!id) continue
    if (id.endsWith('@g.us')) return id
  }
  return null
}

/**
 * Extrai phone e lid a partir dos identificadores chatid / chatlid (já resolvidos).
 * Regras:
 *   - termina em @s.whatsapp.net → campo phone (só dígitos normalizados BR)
 *   - termina em @lid → campo lid **com o sufixo @lid** (persistência / lookup)
 * Não replica phone→lid nem lid→phone (intermitência da API).
 */
function extractPhoneLid(chatidRaw: string | undefined | null, chatlidRaw: string | undefined | null): { phone: string | null; lid: string | null } {
  const chatid = String(chatidRaw ?? '').trim()
  const chatlid = String(chatlidRaw ?? '').trim()

  let phone: string | null = null
  let lid: string | null = null

  if (chatid.endsWith('@s.whatsapp.net')) {
    const digits = chatid.replace('@s.whatsapp.net', '')
    phone = normalizeWhatsappBr(digits) || digits || null
  } else if (chatid.endsWith('@lid')) {
    lid = chatid
  }

  if (chatlid.endsWith('@lid')) {
    lid = chatlid
  } else if (chatlid.endsWith('@s.whatsapp.net')) {
    const digits = chatlid.replace('@s.whatsapp.net', '')
    const n = normalizeWhatsappBr(digits) || digits || null
    phone = phone ?? n
  }

  return { phone, lid }
}

function firstNonEmpty(...parts: Array<string | undefined | null>): string | null {
  for (const p of parts) {
    if (typeof p !== 'string') continue
    const t = p.trim()
    if (t) return t
  }
  return null
}

/**
 * Nome exibido do contato / conversa para UI e Pusher (`mensagem.name`).
 * Prioridade uazapi: `chat.wa_name` → `wa_contactName` → `chat.name` → `senderName`.
 * Não usar em mensagens `fromMe`: ecó da API costuma trazer dados do chat/contato e a UI não deve mostrar foto/nome como se fossem do remetente.
 */
function resolveContactName(payload: UazapiWebhookPayload): string | null {
  const chat = payload.chat
  if (!chat) {
    return firstNonEmpty(payload.message.senderName)
  }
  return firstNonEmpty(
    chat.wa_name,
    chat.wa_contactName,
    chat.name,
    payload.message.senderName,
  )
}

/** Nome do grupo (`groupName` / metadados do chat). */
function resolveGroupName(payload: UazapiWebhookPayload): string | null {
  const chat = payload.chat
  return firstNonEmpty(
    payload.message.groupName,
    chat?.wa_name,
    chat?.name,
  )
}

function resolveContactPhoto(payload: UazapiWebhookPayload): string | null {
  const chat = payload.chat
  return firstNonEmpty(chat?.imagePreview, chat?.image)
}

function resolveGroupPhoto(payload: UazapiWebhookPayload): string | null {
  const chat = payload.chat
  return firstNonEmpty(chat?.imagePreview, chat?.image)
}

function isMensagemIa(msg: UazapiMessage): boolean {
  const trackId = typeof msg.track_id === 'string' ? msg.track_id.trim().toLowerCase() : ''
  return trackId === 'ia'
}

/** Foto do remetente em mensagem de grupo (se a API enviar). */
function resolveSenderPhoto(msg: UazapiMessage): string | null {
  const raw = msg as Record<string, unknown>
  return firstNonEmpty(
    typeof raw.senderPhoto === 'string' ? raw.senderPhoto : null,
    typeof raw.sender_photo === 'string' ? raw.sender_photo : null,
    typeof raw.profilePic === 'string' ? raw.profilePic : null,
  )
}

/** Nome do remetente em mensagem de grupo. */
function resolveSenderName(msg: UazapiMessage): string | null {
  return firstNonEmpty(msg.senderName)
}

/**
 * Normaliza o messageType vindo da uazapi (ex: "Conversation", "ExtendedTextMessage")
 * para os valores do nosso enum MessageType.
 *
 * Regras:
 *   - Converte a primeira letra para minúscula
 *   - extendedTextMessage → conversation (é só texto com formatação/link)
 *   - qualquer valor desconhecido cai em 'desconhecido'
 */
function normalizeMessageType(raw: string): MessageType {
  if (!raw) return 'desconhecido'

  const camel = (raw.charAt(0).toLowerCase() + raw.slice(1)) as MessageType

  if (camel === 'extendedTextMessage') return 'conversation'

  const known: MessageType[] = [
    'associatedChildMessage', 'audioMessage', 'buttonsMessage', 'contactMessage',
    'contactsArrayMessage', 'conversation', 'desconhecido', 'documentMessage',
    'documentWithCaptionMessage', 'editedMessage', 'ephemeralMessage',
    'extendedTextMessage', 'groupInviteMessage', 'imageMessage',
    'interactiveMessage', 'listMessage', 'liveLocationMessage', 'locationMessage', 'lottieStickerMessage',
    'orderMessage', 'pinInChatMessage', 'placeholderMessage', 'productMessage',
    'ptvMessage', 'reactionMessage', 'stickerMessage', 'templateButtonReplyMessage',
    'templateMessage', 'unknown', 'videoMessage', 'viewOnceMessage',
  ]

  return known.includes(camel) ? camel : 'desconhecido'
}

// ---------------------------------------------------------------------------
// Função principal
// ---------------------------------------------------------------------------

/**
 * Normaliza o payload bruto da uazapi para um objeto padronizado.
 *
 * Retorna `null` quando `EventType !== 'messages'` ou quando não há identificador de chat/grupo.
 *
 * **Grupos (`isGroup`):** `id_group` / `name_group` alimentam `conversas`; `name` / `phone` / `lid` = remetente (só `mensagens`).
 *
 * @param payload  Body bruto recebido no webhook
 * @param idCanal  ID do canal buscado no banco via `payload.token`
 */
export function normalizarMensagem(
  payload: UazapiWebhookPayload,
  idCanal: number,
  workspaceId: number | null,
): MensagemNormalizada | null {

  // 1. Filtra apenas eventos de mensagem
  if (payload.EventType !== 'messages') return null

  const msg = payload.message

  // 2. Phone, LID e nome (grupo vs contato individual)
  const { chatid: resolvedChatid, chatlid: resolvedChatlid } = resolveChatIdentifiers(payload)

  let phone: string | null
  let lid: string | null
  let name: string | null
  let photo: string | null
  let id_group: string | null = null
  let name_group: string | null = null

  if (msg.isGroup) {
    id_group = extractGroupId(resolvedChatid, msg.chatid)
    if (!id_group) return null

    name_group = resolveGroupName(payload)

    const sender = extractPhoneLid(msg.sender_pn, msg.sender_lid ?? msg.sender)
    phone = sender.phone
    lid = sender.lid
    name = msg.fromMe ? null : resolveSenderName(msg)
    photo = msg.fromMe ? null : resolveGroupPhoto(payload)
  } else {
    let extracted = extractPhoneLid(resolvedChatid, resolvedChatlid)
    if (!extracted.phone && !extracted.lid) {
      extracted = extractPhoneLid(msg.sender_pn, msg.sender_lid ?? msg.sender)
    }
    phone = extracted.phone
    lid = extracted.lid
    name = msg.fromMe ? null : resolveContactName(payload)
    photo = msg.fromMe ? null : resolveContactPhoto(payload)
  }

  const messagetype = normalizeMessageType(msg.messageType)

  return {
    // ── mensagens ──────────────────────────────────────────────────────────
    message_id:      msg.messageid,
    from_me:         msg.fromMe || msg.wasSentByApi === true,
    message:         msg.text?.trim() || null,
    phone,
    lid,
    connected_phone: payload.owner,
    messagetype,
    from_api:        msg.wasSentByApi,
    id_canal:        idCanal,
    workspace_id:    workspaceId,
    media_url:       null,
    caption:         null,
    filename:        null,

    // ── conversas (key resolvida em persistWebhookMensagem) ───────────────
    name,
    photo,
    message_timestamp: msg.messageTimestamp,
    is_group: Boolean(msg.isGroup),
    id_group,
    name_group,
    from_ia: isMensagemIa(msg),
    replyid: parseQuotedReplyId(msg),
  }
}
