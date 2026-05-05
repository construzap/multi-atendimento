import type { MessageType } from '#shared/types/messageType'

/**
 * Linha de mensagem na API: base em `public.mensagens` + `name`/`photo` da conversa (contato).
 */
export interface Mensagem {
  /** ID temporário (optimistic UI) para conciliar com Pusher. */
  temp_id?: string | null
  message_id: string
  created_at: string
  from_me: boolean | null
  message: string | null
  phone: string | null
  lid: string | null
  connected_phone: string | null
  messagetype: MessageType | null
  from_api: boolean | null
  id_canal: number | null
  media_url: string | null
  caption: string | null
  filename: string | null
  name: string | null
  photo: string | null
}

/**
 * Resposta paginada de `GET /api/mensagens`.
 */
export interface MensagensListResponse {
  data: Mensagem[]
  page: number
  perPage: number
  total: number
}

/**
 * Corpo do evento Pusher `nova-mensagem`.
 * Canal Pusher = só `id_canal` (ex.: subscribe em `"12"`); use `conversa_key` para saber o fio da conversa.
 */
export interface PusherNovaMensagemPayload {
  /** `conversas.key` = `{id_canal}-{lid}` — qual conversa dentro do canal. */
  conversa_key: string
  mensagem: Mensagem
}

