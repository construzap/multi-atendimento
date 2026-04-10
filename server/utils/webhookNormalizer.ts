import type { MessageType } from '#shared/types/messageType'
import type { MensagemNormalizada, UazapiWebhookPayload } from '#shared/types/webhook'

// ---------------------------------------------------------------------------
// Helpers de normalização
// ---------------------------------------------------------------------------

/**
 * Extrai phone e lid a partir dos campos chatid / chatlid da uazapi.
 * Regras:
 *   - termina em @s.whatsapp.net → campo phone (remove o sufixo)
 *   - termina em @lid            → campo lid   (remove o sufixo)
 *   - se apenas um deles existir → assume para os dois
 */
function extractPhoneLid(chatid: string, chatlid: string): { phone: string | null; lid: string | null } {
  let phone: string | null = null
  let lid: string | null = null

  if (chatid.endsWith('@s.whatsapp.net')) {
    phone = chatid.replace('@s.whatsapp.net', '')
  } else if (chatid.endsWith('@lid')) {
    lid = chatid.replace('@lid', '')
  }

  if (chatlid?.endsWith('@lid')) {
    lid = chatlid.replace('@lid', '')
  } else if (chatlid?.endsWith('@s.whatsapp.net')) {
    phone = chatlid.replace('@s.whatsapp.net', '')
  }

  // Se só veio um dos dois, replica para o outro
  if (phone && !lid) lid = phone
  if (lid && !phone) phone = lid

  return { phone, lid }
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
    'interactiveMessage', 'listMessage', 'locationMessage', 'lottieStickerMessage',
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

  // 3. Phone e LID
  const { phone, lid } = extractPhoneLid(msg.chatid, msg.chatlid)

  // 4. Tipo de mensagem normalizado
  const messagetype = normalizeMessageType(msg.messageType)

  // 5. Nome do contato (somente quando a msg vem do usuário, não de mim)
  const name = msg.fromMe ? null : (msg.senderName?.trim() || null)

  // 6. Chave única da conversa: "{id_canal}-{lid}"
  // Se por algum motivo vier sem lid/phone, cai no chatid bruto.
  const lidOrFallback = lid ?? phone ?? msg.chatid
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
    media_url:       null, // TODO: baixar e salvar mídia no Supabase Storage
    caption:         null, // TODO: extrair caption após salvar mídia
    filename:        null, // TODO: extrair filename após salvar mídia

    // ── conversas ──────────────────────────────────────────────────────────
    conversa_key:      conversaKey,
    name,
    photo:             payload.chat.imagePreview || null,
    message_timestamp: msg.messageTimestamp,
  }
}
