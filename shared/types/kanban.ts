/**
 * Kanban / funil por workspace (`funil_workspace`, `funil_workspace_colunas`, `funil_conversa_status`).
 */

import type { TipoCampoPersonalizado } from './camposPersonalizados'

/** Campo personalizado embutido na view `view_conversas_com_detalhes_campos`. */
export type KanbanCampoPersonalizadoResumo = {
  id: number
  nome: string
  tipo: TipoCampoPersonalizado
  valor: string | null
}

export type KanbanCard = {
  /** PK em `funil_conversa_status` / FK para `conversas.key`. */
  conversa_key: string
  coluna_id: number
  /** 1=baixa, 2=média, 3=alta (smallint no DB). */
  prioridade: number | null
  name: string | null
  phone: string | null
  photo: string | null
  /** LID WhatsApp (`conversas.lid`); usado no envio quando não há telefone. */
  lid: string | null
  preview: string | null
  updated_at: string | null
  /** Nome do canal (`canais.nome`) da conversa; null se sem canal ou sem nome. */
  canal_nome: string | null
  /** Canal da conversa (`conversas.id_canal`); necessário para carregar mensagens. */
  id_canal: number | null
  /** Grupo WhatsApp (`conversas.is_group`). */
  is_group: boolean | null
  /** Mensagens não lidas (`conversas.nao_lidas`). */
  nao_lidas: number
  /** Valores dos campos personalizados (view `view_conversas_com_detalhes_campos`). */
  campos_personalizados: KanbanCampoPersonalizadoResumo[]
}

export type KanbanColumn = {
  id: number
  nome: string
  cor: string | null
  ordem: number
  cards: KanbanCard[]
  /** Total de cards na coluna (independente da paginação). */
  total_cards: number
  /** Há mais cards além dos já carregados em `cards`. */
  has_more: boolean
}

export type KanbanBoardResponse = {
  funil_id: number
  funil_nome: string
  columns: KanbanColumn[]
}

/** Resposta parcial ao carregar mais cards de uma coluna. */
export type KanbanColumnPageResponse = {
  coluna_id: number
  cards: KanbanCard[]
  total_cards: number
  has_more: boolean
}
