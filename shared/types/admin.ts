/** Workspace listado no painel admin (inclui dono). */
export interface AdminWorkspace {
  id: number
  nome: string
  descricao: string | null
  created_at: string
  user_id: string
  /** Limite de produtos do workspace (`workspace.limite_produtos`). */
  limite_produtos: number | null
}

export interface AdminAtualizarLimiteProdutosBody {
  workspace_id: number
  limite_produtos: number | null
}

export interface AdminAtualizarLimiteProdutosResponse {
  id: number
  limite_produtos: number | null
}

/** Linha exibida no seletor de empresas do painel admin (design / integração futura). */
export interface AdminEmpresaRow {
  id: string
  name: string | null
  user_id: string
  /** Quantidade de instâncias WhatsApp vinculadas (badge opcional). */
  instance_count: number
}
