/**
 * Tabela `public.workspace` (Supabase).
 * Tipagem mínima para listagem de workspaces no app.
 */
export interface Workspace {
  id: number
  nome: string
  descricao: string | null
  /** Máximo de produtos no workspace. `null` = sem limite. */
  limite_produtos: number | null
  created_at: string
}

