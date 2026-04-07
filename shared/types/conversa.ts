/**
 * Tabela `public.conversas` (Supabase) — campos expostos na API (sem `deleted_at` / `deleted_by`).
 */
import type { MessageType } from '#shared/types/messageType'

export interface Conversa {
  key: string
  message: string | null
  /** Nome do campo na tabela (grafia do banco). */
  messatype: MessageType | null
  name: string | null
  created_at: string | null
  updated_at: string | null
  id_canal: number | null
  phone: string | null
  lid: string | null
  connect_phone: string | null
  photo: string | null
  from_me: boolean | null
  media_url: string | null
}

/**
 * Resposta paginada de `GET /api/conversas`.
 */
export interface ConversasListResponse {
  data: Conversa[]
  page: number
  perPage: number
  total: number
}
