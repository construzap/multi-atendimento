/**
 * Tabela `public.canais` (Supabase) — projeção mínima para listagem.
 */
export interface Canal {
  id: number
  nome: string | null
  descricao: string | null
  token: string | null
  servidor: string | null
  provedor: number | null
  created_at: string
}
