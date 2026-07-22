/**
 * Tabela `public.conversas` (Supabase) — campos expostos na API (sem `deleted_at` / `deleted_by`).
 */
import type { TipoCampoPersonalizado } from '#shared/types/camposPersonalizados'
import type { MessageType } from '#shared/types/messageType'

/** Valor de campo personalizado embutido na conversa (definição + valor). */
export type ConversaCampoPersonalizado = {
  id: number
  nome: string
  tipo: TipoCampoPersonalizado
  valor: string | null
}

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
  conversa_aberta: boolean | null
  is_group: boolean | null
  id_group: string | null
  name_group: string | null
  nao_lidas: number
  funil_id: number | null
  coluna_id: number | null
  atendente_id: number | null
  /** I.A. ligada (`conversas.ia_ligada`). */
  ia_ligada: boolean | null
  /**
   * Campos personalizados da conversa (definição + valor).
   * `undefined` = ainda não carregados; array (mesmo vazio) = já buscados na API.
   */
  campos_personalizados?: ConversaCampoPersonalizado[]
}

/** Campos editáveis em `PATCH /api/conversas/atualizar`. */
export type ConversaPatch = {
  name?: string | null
  phone?: string
  coluna_id?: number | null
  ia_ligada?: boolean
}

/** Resposta de `PATCH /api/conversas/atualizar`. */
export interface ConversaAtualizarResponse {
  data: Conversa
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
