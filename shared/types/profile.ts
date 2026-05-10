/**
 * Tabela `public.profiles` (Supabase).
 * Tipagem dos campos utilizados no perfil do usuário no app.
 */
export interface UserProfile {
  /** `profiles.created_at` */
  created_at: string
  /** `profiles.email` */
  email: string
  /** `profiles.full_name` */
  full_name: string | null
  /** `profiles.whatsapp` (telefone) */
  whatsapp: string | null
}

/** Valores de `vw_perfil_consolidado.status_assinatura`. */
export type StatusAssinatura = 'trial' | 'pendente' | 'ativo' | 'vencida' | 'cancelado'

/**
 * Campos de assinatura expostos pelo endpoint `GET /api/perfil/assinatura`
 * (`public.vw_perfil_consolidado`).
 */
export interface PerfilAssinatura {
  /** `profiles.data_expiracao`, formato legível tipo Postgres timestamptz */
  data_expiracao: string | null
  /** Quantidade de canais contratados (`profiles.canais`) */
  canais: number | null
  /** Quantidade de canais já criados (subconsulta na view) */
  canais_criados: number
  status_assinatura: StatusAssinatura | null
}

