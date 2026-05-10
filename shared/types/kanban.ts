/**
 * Kanban / funil por workspace (`funil_workspace`, `funil_workspace_colunas`, `funil_conversa_status`).
 */

export type KanbanCard = {
  /** PK em `funil_conversa_status` / FK para `conversas.key`. */
  conversa_key: string
  coluna_id: number
  /** 1=baixa, 2=média, 3=alta (smallint no DB). */
  prioridade: number | null
  name: string | null
  phone: string | null
  photo: string | null
  preview: string | null
  updated_at: string | null
  /** Nome do canal (`canais.nome`) da conversa; null se sem canal ou sem nome. */
  canal_nome: string | null
}

export type KanbanColumn = {
  id: number
  nome: string
  cor: string | null
  ordem: number
  cards: KanbanCard[]
}

export type KanbanBoardResponse = {
  funil_id: number
  funil_nome: string
  columns: KanbanColumn[]
}
