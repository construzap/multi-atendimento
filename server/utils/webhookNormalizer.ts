import type { MessageType } from '#shared/types/messageType'
import type { MensagemNormalizada, UazapiMessage, UazapiWebhookPayload } from '#shared/types/webhook'

const MEDIA_MEDIA_TYPES = ['image', 'video', 'ptt', 'audio', 'document', 'sticker'] as const

/** Mensagem de mídia suportada para download + B2 (uazapi `type === 'media'`). */
export function isMediaMessage(msg: UazapiMessage): boolean {
  if (msg.type !== 'media') return false
  return (MEDIA_MEDIA_TYPES as readonly string[]).includes(msg.mediaType)
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

  const waCid = typeof chat.wa_chatid === 'string' ? chat.wa_chatid.trim() : ''
  const waLid = typeof chat.wa_chatlid === 'string' ? chat.wa_chatlid.trim() : ''
  const mCid = typeof msg.chatid === 'string' ? msg.chatid.trim() : ''
  const mLid = typeof msg.chatlid === 'string' ? msg.chatlid.trim() : ''

  return {
    chatid: waCid || mCid,
    chatlid: waLid || mLid,
  }
}

/**
 * Extrai phone e lid a partir dos identificadores chatid / chatlid (já resolvidos).
 * Regras:
 *   - termina em @s.whatsapp.net → campo phone (remove o sufixo)
 *   - termina em @lid            → campo lid   (remove o sufixo)
 *   - se apenas um deles existir → assume para os dois
 */
function extractPhoneLid(chatidRaw: string | undefined | null, chatlidRaw: string | undefined | null): { phone: string | null; lid: string | null } {
  const chatid = String(chatidRaw ?? '').trim()
  const chatlid = String(chatlidRaw ?? '').trim()

  let phone: string | null = null
  let lid: string | null = null

  if (chatid.endsWith('@s.whatsapp.net')) {
    phone = chatid.replace('@s.whatsapp.net', '')
  } else if (chatid.endsWith('@lid')) {
    lid = chatid.replace('@lid', '')
  }

  if (chatlid.endsWith('@lid')) {
    lid = chatlid.replace('@lid', '')
  } else if (chatlid.endsWith('@s.whatsapp.net')) {
    phone = chatlid.replace('@s.whatsapp.net', '')
  }

  // Se só veio um dos dois, replica para o outro
  if (phone && !lid) lid = phone
  if (lid && !phone) phone = lid

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
 * Nome exibido do contato na conversa (persistido em `conversas.name` / Pusher).
 * Prioridade uazapi: `wa_name` → `wa_contactName` → `chat.name` → `senderName`.
 */
function resolveContactName(payload: UazapiWebhookPayload): string | null {
  if (payload.message.fromMe) return null
  const chat = payload.chat
  return firstNonEmpty(
    chat.wa_name,
    chat.wa_contactName,
    chat.name,
    payload.message.senderName,
  )
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
 * Retorna `null` nos seguintes casos (evento deve ser ignorado):
 *   - EventType !== 'messages'
 *   - isGroup === true
 *
 * @param payload  Body bruto recebido no webhook
 * @param idCanal  ID do canal buscado no banco via `payload.token`
 */
export function normalizarMensagem(
  payload: UazapiWebhookPayload,
  idCanal: number,
): MensagemNormalizada | null {

  // 1. Filtra apenas eventos de mensagem
  if (payload.EventType !== 'messages') return null

  const msg = payload.message

  // 2. Ignora grupos por enquanto
  if (msg.isGroup) return null

  // 3. Phone e LID (prioriza chat.wa_chatid / wa_chatlid)
  const { chatid: resolvedChatid, chatlid: resolvedChatlid } = resolveChatIdentifiers(payload)
  const { phone, lid } = extractPhoneLid(resolvedChatid, resolvedChatlid)

  // 4. Tipo de mensagem normalizado
  const messagetype = normalizeMessageType(msg.messageType)

  // 5. Nome do contato (mensagens recebidas: wa_name / wa_contactName / …)
  const name = resolveContactName(payload)

  // 6. Chave única da conversa: "{id_canal}-{lid}"
  // Se por algum motivo vier sem lid/phone, cai no chatid resolvido (wa_* ou message).
  const lidOrFallback = lid ?? phone ?? resolvedChatid
  const conversaKey = `${idCanal}-${lidOrFallback}`

  return {
    // ── mensagens ──────────────────────────────────────────────────────────
    message_id:      msg.messageid,
    from_me:         msg.fromMe,
    message:         msg.text?.trim() || null,
    phone,
    lid,
    connected_phone: payload.owner,
    messagetype,
    from_api:        msg.wasSentByApi,
    id_canal:        idCanal,
    media_url:       null,
    caption:         null,
    filename:        null,

    // ── conversas ──────────────────────────────────────────────────────────
    conversa_key:      conversaKey,
    name,
    photo:             payload.chat.imagePreview || null,
    message_timestamp: msg.messageTimestamp,
  }
}
