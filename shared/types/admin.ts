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

/** Candidato de imagem da Brave Image Search API. */
export type AdminImagemBraveItem = {
  title: string
  /** URL da imagem original (`properties.url`). */
  link: string
  thumbnailLink: string | null
  /** Página onde a imagem foi encontrada. */
  contextLink: string | null
  displayLink: string | null
  width: number | null
  height: number | null
}

export type AdminBuscarImagensBraveBody = {
  /** Termo de busca (ex.: nome do produto). */
  q: string
  /** Quantidade (1–200). Default 8. */
  num?: number
}

export type AdminBuscarImagensBraveResponse = {
  q: string
  items: AdminImagemBraveItem[]
}
