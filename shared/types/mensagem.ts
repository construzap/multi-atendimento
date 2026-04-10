import type { MessageType } from '#shared/types/messageType'

/**
 * Tabela `public.mensagens` (Supabase) — campos expostos na API.
 */
export interface Mensagem {
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

