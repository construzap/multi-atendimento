/** Workspace listado no painel admin (inclui dono). */
export interface AdminWorkspace {
  id: number
  nome: string
  descricao: string | null
  created_at: string
  user_id: string
}

/** Linha exibida no seletor de empresas do painel admin (design / integração futura). */
export interface AdminEmpresaRow {
  id: string
  name: string | null
  user_id: string
  /** Quantidade de instâncias WhatsApp vinculadas (badge opcional). */
  instance_count: number
}
