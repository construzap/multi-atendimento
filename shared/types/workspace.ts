/**
 * Tabela `public.workspace` (Supabase).
 * Tipagem mínima para listagem de workspaces no app.
 */
export interface Workspace {
  id: number
  nome: string
  descricao: string | null
  created_at: string
}

