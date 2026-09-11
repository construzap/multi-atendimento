import type { UserRole } from '#shared/types/profile'

/** Linha de `public.vw_perfil_consolidado` + `profiles.role` (campos expostos ao admin). */
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
  limite_mensal_token: number | null
  role: UserRole
  canais_criados: number
  ias_atreladas: number
  status_assinatura: string
  total_tokens_usados: number
  status_limite_tokens: string
}

/** Resposta de `GET /api/admin/gerenciarassinaturas`. */
export interface AdminGerenciarAssinaturasListaResponse {
  perfis: PerfilConsolidadoRow[]
}

/** Resposta de `POST /api/admin/gerenciarassinaturas`. */
export interface AdminGerenciarAssinaturasItemResponse {
  perfil: PerfilConsolidadoRow | null
}

/** @deprecated Use AdminGerenciarAssinaturasItemResponse */
export type AdminGerenciarAssinaturasResponse = AdminGerenciarAssinaturasItemResponse

/** Workspace resumido ligado ao perfil selecionado. */
export interface AdminWorkspaceDoPerfil {
  id: number
  nome: string
}

/** Resposta de `GET /api/admin/gerenciarassinaturas/workspaces`. */
export interface AdminWorkspacesDoPerfilResponse {
  workspaces: AdminWorkspaceDoPerfil[]
}

/**
 * Body de `POST /api/admin/gerenciarassinaturas`.
 * Atualiza campos editáveis em `public.profiles` (exceto id, user_id, created_at).
 */
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
  limite_mensal_token: number
  role: UserRole
}
