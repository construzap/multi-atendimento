/** Linha exibida no seletor de empresas do painel admin (design / integração futura). */
export interface AdminEmpresaRow {
  id: string
  name: string | null
  /** Quantidade de instâncias WhatsApp vinculadas (badge opcional). */
  instance_count: number
}
