import { serverSupabaseServiceRole } from '#supabase/server'
import { createError } from 'h3'
import type { H3Event } from 'h3'
import {
  isEntregaStatus,
  type EntregaPublicaResumo,
  type EntregaStatus,
} from '#shared/types/entrega'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function parseTokenEntrega(raw: unknown): string {
  const token = String(raw ?? '').trim()
  if (!token || !UUID_RE.test(token)) {
    throw createError({ statusCode: 400, statusMessage: 'Token inválido.' })
  }
  return token.toLowerCase()
}

export type NotificacaoEntregaRow = {
  id: number
  workspace_id: number
  nome: string | null
  endereco: string | null
  entrega_status: EntregaStatus
  entregador_id: number | null
  codigo_confirmacao: string | null
  token_entrega: string
}

export async function loadNotificacaoByToken(
  event: H3Event,
  token: string,
): Promise<NotificacaoEntregaRow> {
  const admin = serverSupabaseServiceRole<any>(event)

  const { data, error } = await admin
    .from('notificacoes_ia')
    .select(
      'id, workspace_id, nome, endereco, entrega_status, entregador_id, codigo_confirmacao, token_entrega',
    )
    .eq('token_entrega', token)
    .maybeSingle()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }
  if (!data) {
    throw createError({ statusCode: 404, statusMessage: 'Pedido de entrega não encontrado.' })
  }

  const id = typeof data.id === 'number' ? data.id : Number(data.id)
  const workspaceId =
    typeof data.workspace_id === 'number'
      ? data.workspace_id
      : Number.parseInt(String(data.workspace_id ?? ''), 10)

  if (!Number.isFinite(id) || id < 1 || !Number.isFinite(workspaceId) || workspaceId < 1) {
    throw createError({ statusCode: 500, statusMessage: 'Pedido de entrega inválido.' })
  }

  const statusRaw = data.entrega_status != null ? String(data.entrega_status) : 'aguardando_entregador'
  const entrega_status: EntregaStatus = isEntregaStatus(statusRaw)
    ? statusRaw
    : 'aguardando_entregador'

  const entregadorIdRaw = data.entregador_id
  const entregador_id =
    entregadorIdRaw == null
      ? null
      : typeof entregadorIdRaw === 'number'
        ? entregadorIdRaw
        : Number.parseInt(String(entregadorIdRaw), 10)

  return {
    id,
    workspace_id: workspaceId,
    nome: data.nome != null ? String(data.nome).trim() || null : null,
    endereco: data.endereco != null ? String(data.endereco).trim() || null : null,
    entrega_status,
    entregador_id:
      entregador_id != null && Number.isFinite(entregador_id) && entregador_id >= 1
        ? entregador_id
        : null,
    codigo_confirmacao:
      data.codigo_confirmacao != null ? String(data.codigo_confirmacao).trim() : null,
    token_entrega: String(data.token_entrega),
  }
}

export async function buildEntregaResumo(
  event: H3Event,
  row: NotificacaoEntregaRow,
): Promise<EntregaPublicaResumo> {
  const admin = serverSupabaseServiceRole<any>(event)

  const { data: ws } = await admin
    .from('workspace')
    .select('nome')
    .eq('id', row.workspace_id)
    .maybeSingle()

  let entregador_nome: string | null = null
  if (row.entregador_id != null) {
    const { data: ent } = await admin
      .from('entregadores')
      .select('nome')
      .eq('id', row.entregador_id)
      .maybeSingle()
    entregador_nome = ent?.nome != null ? String(ent.nome).trim() || null : null
  }

  const pedidoLabel = String(row.id).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

  return {
    pedido_id: row.id,
    pedido_label: pedidoLabel,
    entrega_status: row.entrega_status,
    entregador_identificado: row.entregador_id != null,
    entregador_nome,
    loja_nome: ws?.nome != null ? String(ws.nome).trim() || null : null,
    endereco: row.endereco,
    cliente_nome: row.nome,
  }
}

/** Normaliza código do entregador (trim + uppercase). */
export function normalizeCodigoEntregador(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
}

/** Normaliza código de confirmação do cliente (trim; letras/números/especiais). */
export function normalizeCodigoConfirmacao(raw: unknown): string {
  return String(raw ?? '').trim()
}

/** Comparação case-insensitive (maiúsculas/minúsculas equivalentes). */
export function codigoConfirmacaoConfere(informado: string, esperado: string): boolean {
  const a = normalizeCodigoConfirmacao(informado)
  const b = normalizeCodigoConfirmacao(esperado)
  if (!a || !b) return false
  return a.toLocaleUpperCase('pt-BR') === b.toLocaleUpperCase('pt-BR')
}
