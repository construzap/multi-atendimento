/** Item da listagem (GET /api/entregadores). */
export type EntregadorListaItem = {
  id: number
  codigo: string
  nome: string
  ativo: boolean
  entregador_premium: boolean
  created_at: string
  updated_at: string
}

export type EntregadoresListResponse = {
  data: EntregadorListaItem[]
}

export type EntregadorCreateBody = {
  workspace_id: number
  codigo: string
  nome: string
  ativo?: boolean
  entregador_premium?: boolean
}

export type EntregadorUpdateBody = {
  workspace_id: number
  id: number
  codigo?: string
  nome?: string
  ativo?: boolean
  entregador_premium?: boolean
}
