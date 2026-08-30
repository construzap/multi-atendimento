import { assertMethod, createError, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { KanbanNotificacaoIa, PusherKanbanAtualizacaoPayload } from '#shared/types/kanban'
import {
  mapNotificacaoIaRow,
  normalizeProdutosRaw,
  normalizeTotalOrcamento,
  NOTIFICACAO_IA_SELECT,
} from '#shared/utils/notificacaoIaProdutos'
import { requireN8nKanbanApiKey } from '../../utils/requireN8nKanbanApiKey'
import { triggerKanbanAtualizacao } from '../../utils/pusherServer'

type ProdutoBody = {
  nome?: unknown
  nome_produto?: unknown
  qtd?: unknown
  quantidade?: unknown
  preco?: unknown
  preco_vista?: unknown
  preco_prazo?: unknown
}

type Body = {
  workspace_id?: unknown
  conversa_key?: unknown
  /** Canal do Pusher — preferir enviar para não consultar `conversas`. */
  canal_id?: unknown
  /** Se informado, atualiza `conversas.coluna_id` / `funil_id` (mesmo se o N8N já gravou). */
  coluna_id?: unknown
  /**
   * Se o pedido já foi inserido no Supabase pelo N8N, informe o id —
   * o app só busca e notifica via Pusher.
   */
  notificacao_id?: unknown
  /** Cria `pedido_pronto` em `notificacoes_ia` (alternativa a `notificacao_id`). */
  produtos?: unknown
  forma_pagamento?: unknown
  total_orcamento?: unknown
  observacoes?: unknown
  entrega_ou_retirada?: unknown
  endereco?: unknown
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

function parseOptionalPositiveInt(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === '') return null
  return parsePositiveInt(raw, 'id')
}

function strOrNull(v: unknown): string | null {
  if (v === undefined || v === null) return null
  const s = typeof v === 'string' ? v.trim() : String(v).trim()
  return s.length ? s : null
}

function formatPrecoBr(valor: number): string {
  return valor.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function parsePrecoNumber(raw: unknown): number {
  if (typeof raw === 'number') return raw
  return Number.parseFloat(String(raw ?? '').replace(/\./g, '').replace(',', '.'))
}

/**
 * Aceita:
 * - `[{ nome|nome_produto, qtd|quantidade, preco|preco_vista|preco_prazo }, …]`
 * - `["50X CIMENTO - R$ 54,00", "2X AREIA - R$ 130,00"]`
 * - `"50X CIMENTO - R$ 54,00\\n2X AREIA - R$ 130,00"` (string multilinha)
 *
 * Se `produtos` chegar como string `"[object Object],…"` (erro clássico do N8N
 * ao interpolar array em JSON texto), devolve 400 com orientação.
 */
function parseProdutosBody(raw: unknown): { linhas: string[]; total: number } {
  // String: pode ser multilinha formatada OU JSON array stringificado pelo N8N.
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (/\[object Object\]/i.test(trimmed)) {
      throw createError({
        statusCode: 400,
        statusMessage:
          'produtos chegou como "[object Object]". No N8N use body ={{ { ..., produtos: $json.produtos } }} (objeto JS), sem JSON.stringify.',
      })
    }
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed) as unknown
        if (Array.isArray(parsed)) {
          return parseProdutosBody(parsed)
        }
      } catch {
        // cai no fluxo de linhas abaixo
      }
    }
    const linhas = trimmed
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
    if (linhas.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Informe ao menos um produto em produtos.',
      })
    }
    return { linhas, total: 0 }
  }

  if (!Array.isArray(raw) || raw.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Informe ao menos um produto em produtos[].',
    })
  }

  // Array de strings já formatadas (ou um único item com várias linhas).
  if (raw.every((item) => typeof item === 'string')) {
    const linhas = (raw as string[])
      .flatMap((s) => s.split(/\r?\n/))
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
    if (linhas.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Informe ao menos um produto em produtos[].',
      })
    }
    return { linhas, total: 0 }
  }

  const linhas: string[] = []
  let total = 0

  for (const item of raw as ProdutoBody[]) {
    if (!item || typeof item !== 'object') {
      throw createError({ statusCode: 400, statusMessage: 'Produto inválido.' })
    }
    const nome = strOrNull(item.nome) ?? strOrNull(item.nome_produto)
    if (!nome) {
      throw createError({ statusCode: 400, statusMessage: 'Nome do produto é obrigatório.' })
    }

    const qtdRaw = item.qtd ?? item.quantidade
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

    const precoRaw = item.preco ?? item.preco_vista ?? item.preco_prazo
    const preco = parsePrecoNumber(precoRaw)
    if (!Number.isFinite(preco) || preco < 0) {
      throw createError({
        statusCode: 400,
        statusMessage: `Preço inválido para «${nome}».`,
      })
    }

    total += qtd * preco
    linhas.push(`${qtd}X ${nome} - R$ ${formatPrecoBr(preco)}`)
  }

  return { linhas, total }
}

function temProdutosNoBody(raw: unknown): boolean {
  if (typeof raw === 'string') return raw.trim().length > 0
  return Array.isArray(raw) && raw.length > 0
}

function mapNotificacao(row: Record<string, unknown>): KanbanNotificacaoIa {
  return mapNotificacaoIaRow(row)
}

const NOTIF_SELECT = NOTIFICACAO_IA_SELECT

/**
 * POST /api/public/kanban-atualizacao
 *
 * Integração N8N (sem login de usuário): move card no funil e/ou cria/notifica pedido,
 * e dispara Pusher `kanban-atualizacao` para quem estiver no workspace com o canal inscrito.
 *
 * Auth: Authorization: Bearer <NUXT_N8N_KANBAN_API_KEY>  ou  x-api-key: <…>
 *
 * Body típico (pedido já criado no banco):
 *   { workspace_id, conversa_key, canal_id, notificacao_id }
 * Com `canal_id`, não consulta `conversas` só para descobrir o canal.
 * Som no browser: pedido_pronto; se `id_cobranca` preenchido, só com `pagamento_realizado=true`.
 */
export default defineEventHandler(async (event) => {
  assertMethod(event, 'POST')
  requireN8nKanbanApiKey(event)

  const body = (await readBody(event).catch(() => null)) as Body | null
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Body JSON inválido.' })
  }

  const workspaceId = parsePositiveInt(body.workspace_id, 'workspace_id')
  const conversaKey = strOrNull(body.conversa_key)
  if (!conversaKey) {
    throw createError({ statusCode: 400, statusMessage: 'Informe conversa_key.' })
  }

  const colunaIdOpt = parseOptionalPositiveInt(body.coluna_id)
  const notificacaoIdOpt = parseOptionalPositiveInt(body.notificacao_id)
  const canalIdBody = parseOptionalPositiveInt(body.canal_id)
  const temProdutos = temProdutosNoBody(body.produtos)

  if (colunaIdOpt == null && !temProdutos && notificacaoIdOpt == null) {
    throw createError({
      statusCode: 400,
      statusMessage:
        'Informe coluna_id e/ou produtos (criar pedido) e/ou notificacao_id (já existente).',
    })
  }

  const admin = serverSupabaseServiceRole<any>(event)

  /**
   * Com `canal_id` no body: não lê `conversas` só para descobrir o canal.
   * Ainda atualiza `conversas` se `coluna_id` vier no body.
   * Sem `canal_id`: fallback legado (SELECT em conversas).
   */
  let idCanal = canalIdBody
  let colunaIdFinal: number | null = colunaIdOpt
  let funilIdFinal: number | null = null
  let nomeContato: string | null = strOrNull(body.nome) ?? strOrNull(body.fone)
  let moveuColuna = false

  if (idCanal == null) {
    const { data: conversa, error: convErr } = await admin
      .from('conversas')
      .select('key, workspace_id, id_canal, name, phone, coluna_id, funil_id')
      .eq('key', conversaKey)
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .maybeSingle()

    if (convErr) throw createError({ statusCode: 500, statusMessage: convErr.message })
    if (!conversa) {
      throw createError({ statusCode: 404, statusMessage: 'Conversa não encontrada neste workspace.' })
    }

    idCanal =
      typeof conversa.id_canal === 'number'
        ? conversa.id_canal
        : Number.parseInt(String(conversa.id_canal ?? ''), 10)
    if (!Number.isFinite(idCanal) || idCanal == null || idCanal < 1) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Conversa sem id_canal válido — não é possível notificar o Pusher.',
      })
    }

    colunaIdFinal =
      typeof conversa.coluna_id === 'number'
        ? conversa.coluna_id
        : conversa.coluna_id != null
          ? Number.parseInt(String(conversa.coluna_id), 10)
          : null
    if (colunaIdFinal != null && (!Number.isFinite(colunaIdFinal) || colunaIdFinal < 1)) {
      colunaIdFinal = null
    }

    funilIdFinal =
      typeof conversa.funil_id === 'number'
        ? conversa.funil_id
        : conversa.funil_id != null
          ? Number.parseInt(String(conversa.funil_id), 10)
          : null
    if (funilIdFinal != null && (!Number.isFinite(funilIdFinal) || funilIdFinal < 1)) {
      funilIdFinal = null
    }

    nomeContato =
      strOrNull(body.nome) ??
      strOrNull(conversa.name) ??
      strOrNull(body.fone) ??
      strOrNull(conversa.phone)
  }

  if (colunaIdOpt != null) {
    const { data: coluna, error: colErr } = await admin
      .from('funil_workspace_colunas')
      .select('id, funil_id')
      .eq('id', colunaIdOpt)
      .is('deleted_at', null)
      .maybeSingle()

    if (colErr) throw createError({ statusCode: 500, statusMessage: colErr.message })
    if (!coluna) {
      throw createError({ statusCode: 400, statusMessage: 'Coluna inválida ou não encontrada.' })
    }

    const funilId =
      typeof coluna.funil_id === 'number'
        ? coluna.funil_id
        : Number.parseInt(String(coluna.funil_id ?? '').trim(), 10)
    if (!Number.isFinite(funilId) || funilId < 1) {
      throw createError({ statusCode: 400, statusMessage: 'Funil da coluna inválido.' })
    }

    const { data: funil, error: funilErr } = await admin
      .from('funil_workspace')
      .select('id')
      .eq('id', funilId)
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (funilErr) throw createError({ statusCode: 500, statusMessage: funilErr.message })
    if (!funil) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Coluna não pertence a um funil deste workspace.',
      })
    }

    const nowIso = new Date().toISOString()
    const { error: upErr } = await admin
      .from('conversas')
      .update({
        coluna_id: colunaIdOpt,
        funil_id: funilId,
        updated_at: nowIso,
      })
      .eq('key', conversaKey)
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)

    if (upErr) throw createError({ statusCode: 500, statusMessage: upErr.message })

    colunaIdFinal = colunaIdOpt
    funilIdFinal = funilId
    moveuColuna = true
  }

  let notificacao: KanbanNotificacaoIa | null = null
  let notifRowExtra: { nome?: unknown; fone?: unknown } | null = null

  if (notificacaoIdOpt != null) {
    const { data: row, error: nErr } = await admin
      .from('notificacoes_ia')
      .select(NOTIF_SELECT)
      .eq('id', notificacaoIdOpt)
      .maybeSingle()

    if (nErr) throw createError({ statusCode: 500, statusMessage: nErr.message })
    if (!row) {
      throw createError({
        statusCode: 404,
        statusMessage: 'notificacao_id não encontrada.',
      })
    }
    notifRowExtra = row as Record<string, unknown>
    notificacao = mapNotificacao(row as Record<string, unknown>)
  } else if (temProdutos) {
    const formaPagamento = strOrNull(body.forma_pagamento)
    if (!formaPagamento) {
      throw createError({ statusCode: 400, statusMessage: 'Informe forma_pagamento ao criar pedido.' })
    }

    const { linhas, total: totalCalculado } = parseProdutosBody(body.produtos)
    const totalBody = normalizeTotalOrcamento(
      body.total_orcamento != null ? body.total_orcamento : totalCalculado,
    )

    const nowIso = new Date().toISOString()
    const nome = strOrNull(body.nome) ?? nomeContato
    const fone = strOrNull(body.fone)
    const observacoes = strOrNull(body.observacoes)
    const entrega = strOrNull(body.entrega_ou_retirada)
    const endereco = strOrNull(body.endereco)

    const { data: created, error: insErr } = await admin
      .from('notificacoes_ia')
      .insert({
        workspace_id: workspaceId,
        canal_id: idCanal,
        conversa_key: conversaKey,
        fone,
        nome,
        produtos: linhas,
        total_orcamento: totalBody,
        forma_pagamento: formaPagamento,
        observacoes,
        entrega_ou_retirada: entrega,
        endereco,
        tipo_solicitacao: 'pedido_pronto',
        pagamento_realizado: false,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select(NOTIF_SELECT)
      .maybeSingle()

    if (insErr) throw createError({ statusCode: 500, statusMessage: insErr.message })
    if (!created) {
      throw createError({ statusCode: 500, statusMessage: 'Falha ao criar o pedido.' })
    }
    notifRowExtra = created as Record<string, unknown>
    notificacao = mapNotificacao(created as Record<string, unknown>)
  }

  if (!nomeContato && notifRowExtra) {
    nomeContato =
      strOrNull(notifRowExtra.nome) ?? strOrNull(notifRowExtra.fone) ?? null
  }

  if (idCanal == null || !Number.isFinite(idCanal) || idCanal < 1) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Informe canal_id válido (ou conversa com id_canal) para notificar o Pusher.',
    })
  }

  const motivo: PusherKanbanAtualizacaoPayload['motivo'] =
    moveuColuna && notificacao ? 'ambos' : notificacao ? 'pedido' : 'coluna'

  const payload: PusherKanbanAtualizacaoPayload = {
    workspace_id: workspaceId,
    conversa_key: conversaKey,
    id_canal: idCanal,
    coluna_id: colunaIdFinal,
    funil_id: funilIdFinal,
    nome_contato: nomeContato,
    notificacao,
    motivo,
  }

  await triggerKanbanAtualizacao(event, idCanal, payload)

  return {
    ok: true as const,
    moveu_coluna: moveuColuna,
    coluna_id: colunaIdFinal,
    funil_id: funilIdFinal,
    id_canal: idCanal,
    notificacao,
    motivo,
  }
})
