import type { MessageType } from '#shared/types/messageType'

/**
 * Payload bruto enviado pela uazapi no webhook (evento `messages`).
 */
export interface UazapiWebhookPayload {
  BaseUrl: string
  EventType: string
  instanceName: string
  owner: string
  token: string
  chatSource: string
  chat: UazapiChat
  message: UazapiMessage
}

export interface UazapiChat {
  id: string
  name: string
  owner: string
  phone: string
  image: string
  imagePreview: string
  wa_chatid: string
  wa_chatlid: string
  wa_contactName: string
  wa_name: string
  wa_isGroup: boolean
  wa_lastMessageSender: string
  wa_lastMessageTextVote: string
  wa_lastMessageType: string
  wa_lastMsgTimestamp: number
  wa_unreadCount: number
  [key: string]: unknown
}

export interface UazapiMessage {
  /** Ex.: `text` | `media` */
  type?: string
  messageid: string
  id: string
  chatid: string
  chatlid: string
  fromMe: boolean
  isGroup: boolean
  groupName: string
  messageType: string
  text: string
  content: unknown
  senderName: string
  sender: string
  sender_lid: string
  sender_pn: string
  mediaType: string
  messageTimestamp: number
  wasSentByApi: boolean
  quoted: string
  reaction: string
  edited: string
  [key: string]: unknown
}

/**
 * Mensagem já mapeada para `mensagens` + campos usados em `conversas` (antes de persistir).
 */
export interface MensagemNormalizada {
  message_id: string
  from_me: boolean
  message: string | null
  phone: string | null
  lid: string | null
  connected_phone: string
  messagetype: MessageType
  from_api: boolean
  id_canal: number
  workspace_id: number | null
  media_url: string | null
  caption: string | null
  filename: string | null

  /** Resolvida em persistência (lookup por canal + lid/phone). */
  name: string | null
  photo: string | null
  message_timestamp: number
}
