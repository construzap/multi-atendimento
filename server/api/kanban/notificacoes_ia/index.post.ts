import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import type {
  KanbanNotificacaoIa,
  KanbanNotificacaoProdutoItem,
  KanbanNotificacaoTotalOrcamento,
} from '#shared/types/kanban'
import {
  normalizeProdutosRaw,
  normalizeTotalOrcamento,
} from '#shared/utils/notificacaoIaProdutos'
import { checkChannel } from '../../../utils/checkChannel'
import { checkWorkspace } from '../../../utils/checkWorkspace'
import { getAuthUserId } from '../../../utils/getAuthUserId'

type Body = {
  workspace_id?: unknown
  canal_id?: unknown
  conversa_key?: unknown
  produtos?: unknown
  total_orcamento?: unknown
  forma_pagamento?: unknown
  observacoes?: unknown
  entrega_ou_retirada?: unknown
  nome?: unknown
  fone?: unknown
}

function parsePositiveInt(raw: unknown, label: string): number {
  const n =
    typeof raw === 'number' && Number.isInteger(raw)
      ? raw
      : Number.parseInt(String(raw ?? '').trim(), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw createError({ statusCode: 400, statusMessage: `${label} inválido.` })
  }
  return n
}

function strOrNull(v: unknown): string | null {
  if (v === undefined || v === null) return null
  const s = typeof v === 'string' ? v.trim() : String(v).trim()
  return s.length ? s : null
}

function parseProdutosBody(raw: unknown): {
  itens: KanbanNotificacaoProdutoItem[]
  total: KanbanNotificacaoTotalOrcamento
} {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Informe ao menos um produto.',
    })
  }

  const itens: KanbanNotificacaoProdutoItem[] = []
  let total_a_vista = 0
  let total_a_prazo = 0

  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      throw createError({ statusCode: 400, statusMessage: 'Produto inválido.' })
    }
    const o = item as Record<string, unknown>
    const nome = strOrNull(o.nome) ?? strOrNull(o.nome_produto)
    if (!nome) {
      throw createError({ statusCode: 400, statusMessage: 'Nome do produto é obrigatório.' })
    }

    const qtdRaw = o.qtd ?? o.quantidade
    const qtd =
      typeof qtdRaw === 'number'
        ? Math.trunc(qtdRaw)
        : Number.parseInt(String(qtdRaw ?? '').trim(), 10)
    if (!Number.isFinite(qtd) || qtd < 1) {
      throw createError({
        statusCode: 400,
        statusMessage: `Quantidade inválida para «${nome}».`,
      })
    }

    const parsePrecoOpcional = (raw: unknown): number | null => {
      if (raw === undefined || raw === null || raw === '') return null
      const n =
        typeof raw === 'number'
          ? raw
          : Number.parseFloat(String(raw).replace(',', '.'))
      if (!Number.isFinite(n) || n < 0) {
        throw createError({
          statusCode: 400,
          statusMessage: `Preço inválido para «${nome}».`,
        })
      }
      return n
    }

    // null permanece null — não substitui prazo por vista nem por 0.
    const precoVista =
      o.preco_vista !== undefined
        ? parsePrecoOpcional(o.preco_vista)
        : parsePrecoOpcional(o.preco)
    const precoPrazo = parsePrecoOpcional(o.preco_prazo)

    const subtotal_vista = precoVista != null ? qtd * precoVista : null
    const subtotal_prazo = precoPrazo != null ? qtd * precoPrazo : null
    if (subtotal_vista != null) total_a_vista += subtotal_vista
    if (subtotal_prazo != null) total_a_prazo += subtotal_prazo

    itens.push({
      quantidade: qtd,
      nome_produto: nome,
      preco_vista: precoVista,
      preco_prazo: precoPrazo,
      subtotal_vista,
      subtotal_prazo,
    })
  }

  const temAlgumPreco = itens.some(
    (i) => i.preco_vista != null || i.preco_prazo != null,
  )
  if (!temAlgumPreco) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Informe ao menos um preço (à vista ou a prazo) nos produtos.',
    })
  }

  return {
    itens,
    total: {
      total_a_vista: itens.every((i) => i.subtotal_vista == null) ? null : total_a_vista,
      total_a_prazo: itens.every((i) => i.subtotal_prazo == null) ? null : total_a_prazo,
    },
  }
}

function mapNotificacao(row: Record<string, unknown>): KanbanNotificacaoIa {
  const forma_pagamento =
    row.forma_pagamento != null ? String(row.forma_pagamento) : null
  const produtos = normalizeProdutosRaw(row.produtos)
  const total_orcamento = normalizeTotalOrcamento(row.total_orcamento)

  return {
    id: typeof row.id === 'number' ? row.id : Number(row.id),
    produtos,
    total_orcamento,
    observacoes: row.observacoes != null ? String(row.observacoes) : null,
    forma_pagamento,
    latitude: row.latitude != null && Number.isFinite(Number(row.latitude)) ? Number(row.latitude) : null,
    longitude:
      row.longitude != null && Number.isFinite(Number(row.longitude)) ? Number(row.longitude) : null,
    tipo_solicitacao: row.tipo_solicitacao != null ? String(row.tipo_solicitacao) : null,
    created_at: row.created_at != null ? String(row.created_at) : new Date().toISOString(),
    updated_at: row.updated_at != null ? String(row.updated_at) : new Date().toISOString(),
    entrega_ou_retirada:
      row.entrega_ou_retirada != null ? String(row.entrega_ou_retirada) : null,
    concluido: row.concluido === true,
  }
}

/**
 * POST /api/kanban/notificacoes_ia
 * Body: `{ workspace_id, canal_id, conversa_key, produtos[{nome,quantidade,preco_vista,preco_prazo}], forma_pagamento? }`
 * Persiste produtos como objetos JSON e cria `pedido_pronto` em `notificacoes_ia`.
 */
export default defineEventHandler(async (event) => {
  assertMethod(event, 'POST')

  const client = await serverSupabaseClient(event)
  const { data: authData, error: authError } = await client.auth.getUser()

  if (authError || !authData.user) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const userId = getAuthUserId(authData.user)
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const body = (await readBody(event)) as Body
  const workspaceId = parsePositiveInt(body.workspace_id, 'workspace_id')
  const canalId = parsePositiveInt(body.canal_id, 'canal_id')
  const conversaKey = strOrNull(body.conversa_key)
  if (!conversaKey) {
    throw createError({ statusCode: 400, statusMessage: 'conversa_key inválida.' })
  }

  const formaPagamento = strOrNull(body.forma_pagamento)
  if (!formaPagamento) {
    throw createError({ statusCode: 400, statusMessage: 'Informe a forma de pagamento.' })
  }

  const { itens, total: totalCalculado } = parseProdutosBody(body.produtos)

  const totalBody =
    body.total_orcamento != null
      ? normalizeTotalOrcamento(body.total_orcamento)
      : totalCalculado

  await checkWorkspace(event, workspaceId, userId)

  const allowedCanal = await checkChannel(event, canalId, userId)
  if (!allowedCanal) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Sem permissão para usar este canal.',
    })
  }

  const admin = serverSupabaseServiceRole<any>(event)

  const { data: canal, error: canalErr } = await admin
    .from('canais')
    .select('id, workspace_id')
    .eq('id', canalId)
    .is('deleted_at', null)
    .is('deleted_by', null)
    .maybeSingle()

  if (canalErr) throw createError({ statusCode: 500, statusMessage: canalErr.message })
  const canalWs =
    typeof canal?.workspace_id === 'number'
      ? canal.workspace_id
      : Number(canal?.workspace_id)
  if (!canal || canalWs !== workspaceId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Canal inválido ou não pertence a este workspace.',
    })
  }

  const { data: conversa, error: convErr } = await admin
    .from('conversas')
    .select('key, workspace_id, id_canal, name, phone')
    .eq('key', conversaKey)
    .is('deleted_at', null)
    .maybeSingle()

  if (convErr) throw createError({ statusCode: 500, statusMessage: convErr.message })
  if (!conversa) {
    throw createError({ statusCode: 404, statusMessage: 'Conversa não encontrada.' })
  }

  const convWs =
    typeof conversa.workspace_id === 'number'
      ? conversa.workspace_id
      : Number(conversa.workspace_id)
  if (convWs !== workspaceId) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Esta conversa não pertence ao workspace informado.',
    })
  }

  const convCanal =
    conversa.id_canal != null
      ? typeof conversa.id_canal === 'number'
        ? conversa.id_canal
        : Number(conversa.id_canal)
      : null
  if (convCanal != null && Number.isFinite(convCanal) && convCanal !== canalId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'canal_id não corresponde à conversa.',
    })
  }

  const nowIso = new Date().toISOString()
  const nome = strOrNull(body.nome) ?? strOrNull(conversa.name)
  const fone = strOrNull(body.fone) ?? strOrNull(conversa.phone)
  const observacoes = strOrNull(body.observacoes)
  const entrega = strOrNull(body.entrega_ou_retirada)

  const { data: created, error: insErr } = await admin
    .from('notificacoes_ia')
    .insert({
      workspace_id: workspaceId,
      canal_id: canalId,
      conversa_key: conversaKey,
      fone,
      nome,
      produtos: itens,
      total_orcamento: totalBody,
      forma_pagamento: formaPagamento,
      observacoes,
      entrega_ou_retirada: entrega,
      tipo_solicitacao: 'pedido_pronto',
      concluido: false,
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select(
      'id, produtos, total_orcamento, observacoes, forma_pagamento, latitude, longitude, tipo_solicitacao, created_at, updated_at, entrega_ou_retirada, concluido',
    )
    .maybeSingle()

  if (insErr) {
    throw createError({ statusCode: 500, statusMessage: insErr.message })
  }
  if (!created) {
    throw createError({ statusCode: 500, statusMessage: 'Falha ao criar o pedido.' })
  }

  const notificacao = mapNotificacao(created as Record<string, unknown>)

  return {
    ok: true as const,
    notificacao,
  }
})
