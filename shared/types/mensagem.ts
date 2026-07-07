import type { MessageType } from '#shared/types/messageType'

/**
 * Linha de mensagem na API: base em `public.mensagens`.
 * `name`/`photo`: coluna `mensagens.name` quando preenchida (ex.: remetente em grupo);
 * fallback opcional para dados da conversa no GET.
 */
export interface Mensagem {
  /** Igual a `public.conversas.key` / `mensagens.key_conversa`. */
  key_conversa?: string | null
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
  /** Indica resposta enviada pela I.A (`track_id === "ia"` no webhook). */
  from_ia?: boolean
  /** `message_id` da mensagem citada (reply). */
  replyid?: string | null
  /** Mensagem citada (resolvida no GET a partir de `replyid`). */
  mensagem_citada?: Mensagem | null
}

/**
 * Resposta paginada de `GET /api/mensagens`.
 * Metadados da conversa vêm de `view_kanban_conversas` (nível conversa, não por mensagem).
 */
export interface MensagensListResponse {
  data: Mensagem[]
  page: number
  perPage: number
  total: number
  id_canal?: number | null
  funil_id?: number | null
  coluna_id?: number | null
  atendente_id?: string | null
}

/**
 * Corpo do evento Pusher `nova-mensagem`.
 * Canal Pusher = só `id_canal` (ex.: subscribe em `"12"`); use `conversa_key` para saber o fio da conversa.
 */
export interface PusherNovaMensagemPayload {
  /** `conversas.key` — qual conversa dentro do canal. */
  conversa_key: string
  mensagem: Mensagem
  /** Metadados do grupo (quando `is_group`). */
  is_group?: boolean
  id_group?: string | null
  name_group?: string | null
  /** Foto do grupo (`conversas.photo`) — não confundir com `mensagem.photo`. */
  conversa_photo?: string | null
}

