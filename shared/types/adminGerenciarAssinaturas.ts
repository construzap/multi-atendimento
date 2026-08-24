/** Linha de `public.vw_perfil_consolidado` (campos expostos ao admin). */
export interface PerfilConsolidadoRow {
  id: string
  user_id: string
  email: string | null
  full_name: string | null
  created_at: string | null
  data_expiracao: string | null
  whatsapp: string | null
  customer: string | null
  subscription_id: string | null
  canais: number | null
  limite_ias: number | null
}

/** Resposta de `GET /api/admin/gerenciarassinaturas`. */
export interface AdminGerenciarAssinaturasResponse {
  perfil: PerfilConsolidadoRow | null
}

/** Body de `POST /api/admin/gerenciarassinaturas`. */
export interface AdminAtualizarPerfilBody {
  user_id: string
  email: string
  full_name?: string | null
  data_expiracao: string
  whatsapp?: string | null
  customer?: string | null
  subscription_id?: string | null
  canais: number
  limite_ias: number
}
