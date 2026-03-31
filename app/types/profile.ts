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
