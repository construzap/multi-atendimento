/**
 * Kanban / funil por workspace (`funil_workspace`, `funil_workspace_colunas`, `conversas.coluna_id`).
 */

import type { TipoCampoPersonalizado } from './camposPersonalizados'

/** Campo personalizado (tabelas `campos_personalizados` + `valores_campos_personalizados`). */
export type KanbanCampoPersonalizadoResumo = {
  id: number
  nome: string
  tipo: TipoCampoPersonalizado
  valor: string | null
}

/** Notificação I.A. agregada na view (`notificacoes_ia`). */
export type KanbanNotificacaoIa = {
  id: number
  produtos: string[]
  total_orcamento: number
  observacoes: string | null
  forma_pagamento: string | null
  latitude: number | null
  longitude: number | null
  tipo_solicitacao: string | null
  created_at: string
  updated_at: string
  entrega_ou_retirada: string | null
  concluido: boolean
}

/**
 * Evento Pusher `kanban-atualizacao` (N8N / integrações).
 * Canal = `String(id_canal)` — mesmo padrão de `nova-mensagem`.
 */
export type PusherKanbanAtualizacaoPayload = {
  workspace_id: number
  conversa_key: string
  id_canal: number
  /** Coluna atual (após update, se houver). */
  coluna_id: number | null
  funil_id?: number | null
  nome_contato?: string | null
  /** Pedido novo (criado ou já existente no banco). */
  notificacao?: KanbanNotificacaoIa | null
  /** Motivo para o toast. */
  motivo: 'coluna' | 'pedido' | 'ambos'
}

export type KanbanCard = {
  /** `conversas.key`. */
  conversa_key: string
  /** Coluna do funil (`conversas.coluna_id`). */
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
  /** Nome do grupo (`conversas.name_group`). */
  name_group: string | null
  /** Conversa aberta (`conversas.conversa_aberta`). */
  conversa_aberta: boolean | null
  /** I.A. ligada (`conversas.ia_ligada`). */
  ia_ligada: boolean | null
  /** Mensagens não lidas (`conversas.nao_lidas`). */
  nao_lidas: number
  /** Valores dos campos personalizados (tabelas, não da view). */
  campos_personalizados: KanbanCampoPersonalizadoResumo[]
  /** Notificações da I.A. agregadas na view (`notificacoes_ia`). */
  notificacoes_ia: KanbanNotificacaoIa[]
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

export type KanbanConversaPatch = {
  name?: string | null
  photo?: string | null
  phone?: string | null
  conversa_aberta?: boolean
  is_group?: boolean
  name_group?: string | null
  ia_ligada?: boolean
  id_canal?: number | null
}

export type KanbanConversaAtualizarResponse = {
  conversa_key: string
  name: string | null
  phone: string | null
  /** Sempre `null` quando o patch alterou `phone`. */
  lid: string | null
  photo: string | null
  updated_at: string | null
  id_canal: number | null
  conversa_aberta: boolean | null
  is_group: boolean | null
  name_group: string | null
  ia_ligada: boolean | null
}

/** Corpo de `POST /api/kanban/contato`. */
export type KanbanCriarContatoBody = {
  workspace_id: number
  nome: string
  telefone: string
  coluna_id: number
  id_canal: number
}

/** Resposta de `POST /api/kanban/contato`. */
export type KanbanCriarContatoResponse = {
  ok: true
  conversa_key: string
  coluna_id: number
}

/** Corpo de `POST /api/kanban/funil`. */
export type KanbanCriarFunilBody = {
  workspace_id: number
  nome: string
}

/** Resposta de `POST /api/kanban/funil`. */
export type KanbanCriarFunilResponse = {
  ok: true
  id: number
  nome: string
  workspace_id: number
  ordem: number
  columns: KanbanFunilColunaResumo[]
}

/** Coluna resumida dentro de um funil (lista em Pinia / GET funis). */
export type KanbanFunilColunaResumo = {
  id: number
  nome: string
  cor: string | null
  ordem: number
}

/** Item de funil (`funil_workspace`). */
export type KanbanFunilItem = {
  id: number
  nome: string
  workspace_id: number
  ordem: number
  created_at: string
  updated_at: string | null
  columns: KanbanFunilColunaResumo[]
}

/** Resposta de `GET /api/kanban/funil`. */
export type KanbanListarFunisResponse = {
  funis: KanbanFunilItem[]
}
