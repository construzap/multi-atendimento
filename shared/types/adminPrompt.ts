/**
 * Tabela `public.prompt_workspace` (Supabase).
 */
export interface PromptWorkspace {
  id: number
  workspace_id: number
  nome: string
  tipo: string
  prompt: string
  created_at: string
  updated_at: string
}

/** Default da coluna `prompt_workspace.tipo` (`default 'ESTOQUE'::text`). */
export const PROMPT_WORKSPACE_TIPO_DEFAULT = 'ESTOQUE'

export const PROMPT_WORKSPACE_TIPOS_OPCOES = [
  { value: 'ESTOQUE', label: 'Estoque' },
  { value: 'AGENDAMENTO', label: 'Agendamento' },
] as const

export type PromptWorkspaceTipo = (typeof PROMPT_WORKSPACE_TIPOS_OPCOES)[number]['value']

export type PromptWorkspaceTipoOpcao = {
  value: string
  label: string
}

/** Resposta de `GET /api/admin/prompt`. */
export interface AdminPromptListResponse {
  items: PromptWorkspaceComPrincipal[]
  prompt_principal_id: number | null
}

export interface PromptWorkspaceComPrincipal extends PromptWorkspace {
  principal: boolean
}

export interface AdminPromptCriarBody {
  workspace_id: number
  nome: string
  prompt: string
  tipo?: string
}

export interface AdminPromptAtualizarBody {
  workspace_id: number
  id: number
  nome: string
  prompt: string
  tipo?: string
  /** `true` define como principal; `false` remove se era o principal. */
  definir_principal?: boolean
}

export interface AdminPromptExcluirBody {
  workspace_id: number
  id: number
}

export interface AdminPromptTornarPrincipalBody {
  workspace_id: number
  id: number
}
