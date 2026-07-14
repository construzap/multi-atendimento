import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import type { ProdutoCriarEmMassaLinha, ProdutosCriarEmMassaResponse } from '#shared/types/produtos'
import { checkLimiteProdutos } from '../../utils/checkLimiteProdutos'
import { checkWorkspace } from '../../utils/checkWorkspace'
import { getAuthUserId } from '../../utils/getAuthUserId'

const MAX_LINHAS_POR_REQUISICAO = 10

type Body = {
  workspace_id?: unknown
  linhas?: unknown
}

function parseWorkspaceId(raw: unknown): number {
  const n =
    typeof raw === 'number' && Number.isInteger(raw)
      ? raw
      : Number.parseInt(String(raw ?? '').trim(), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw createError({ statusCode: 400, statusMessage: 'workspace_id inválido.' })
  }
  return n
}

function strOrNull(v: unknown): string | null {
  if (v === undefined || v === null) return null
  const s = typeof v === 'string' ? v.trim() : String(v).trim()
  return s.length ? s : null
}

function numOrNull(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null
  const n = typeof v === 'number' ? v : Number.parseFloat(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function intOrNull(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null
  const n = typeof v === 'number' ? Math.trunc(v) : Number.parseInt(String(v).trim(), 10)
  return Number.isFinite(n) ? n : null
}

function boolDefault(v: unknown, def: boolean): boolean {
  if (v === undefined || v === null || v === '') return def
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v !== 0
  const s = String(v).trim().toLowerCase()
  if (['0', 'n', 'nao', 'não', 'false', 'f', 'inativo', 'inactive', 'off'].includes(s)) return false
  if (['1', 's', 'sim', 'true', 't', 'ativo', 'active', 'on', 'yes'].includes(s)) return true
  return def
}

async function maiorCodigoNoWorkspace(
  admin: ReturnType<typeof serverSupabaseServiceRole<any>>,
  workspaceId: number,
): Promise<number> {
  const { data, error } = await admin
    .from('produtos_workspace')
    .select('codigo')
    .eq('workspace_id', workspaceId)
    .not('codigo', 'is', null)
    .order('codigo', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  const raw = data?.codigo
  if (raw === undefined || raw === null) return 0
  const n = intOrNull(raw)
  return n != null && n > 0 ? n : 0
}

function normalizarLinha(raw: unknown): ProdutoCriarEmMassaLinha | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const nome = strOrNull(o.nome)
  if (!nome) return null

  const preco = numOrNull(o.preco)
  const preco_custo = numOrNull(o.preco_custo)
  const largura = numOrNull(o.largura)
  const altura = numOrNull(o.altura)
  const comprimento = numOrNull(o.comprimento)

  const linha: ProdutoCriarEmMassaLinha = {
    nome,
    sku: strOrNull(o.sku),
    unidade_venda: strOrNull(o.unidade_venda),
    marca: strOrNull(o.marca),
    preco: preco != null && preco >= 0 ? preco : 0,
    preco_custo: preco_custo != null && preco_custo >= 0 ? preco_custo : 0,
    preco_promocional: (() => {
      const v = numOrNull(o.preco_promocional)
      return v != null && v >= 0 ? v : null
    })(),
    preco_prazo: (() => {
      const v = numOrNull(o.preco_prazo)
      return v != null && v >= 0 ? v : null
    })(),
    peso_kg: (() => {
      const v = numOrNull(o.peso_kg)
      return v != null && v >= 0 ? v : null
    })(),
    estoque: (() => {
      const v = numOrNull(o.estoque)
      return v != null && v >= 0 ? v : null
    })(),
    imagem_url: strOrNull(o.imagem_url),
    infos_relevantes: strOrNull(o.infos_relevantes),
    status: boolDefault(o.status, true),
    categoria_id: (() => {
      const v = intOrNull(o.categoria_id)
      return v != null && v > 0 ? v : null
    })(),
    codigo_ncm: strOrNull(o.codigo_ncm),
    termo_pesquisa: (() => {
      const v = intOrNull(o.termo_pesquisa)
      return v != null && v > 0 ? v : null
    })(),
    codigo_barras_ean: strOrNull(o.codigo_barras_ean),
    largura: largura != null && largura >= 0 ? largura : 0,
    altura: altura != null && altura >= 0 ? altura : 0,
    comprimento: comprimento != null && comprimento >= 0 ? comprimento : 0,
    parent_id: (() => {
      const v = intOrNull(o.parent_id)
      return v != null && v > 0 ? v : null
    })(),
  }
  return linha
}

/**
 * POST /api/produtos/criar-em-massa
 *
 * Body: `{ workspace_id, linhas }` — até 10 linhas por requisição.
 * Insere em `produtos_workspace` gerando `codigo` sequencial por workspace.
 */
export default defineEventHandler(async (event): Promise<ProdutosCriarEmMassaResponse> => {
  assertMethod(event, 'POST')

  const client = await serverSupabaseClient(event)
  const { data: authData, error: authError } = await client.auth.getUser()
  if (authError || !authData.user) throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })

  const userId = getAuthUserId(authData.user)
  if (!userId) throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })

  const body = (await readBody<Body>(event).catch(() => null)) ?? {}
  const workspaceId = parseWorkspaceId(body.workspace_id)
  const linhasRaw = body.linhas

  if (!Array.isArray(linhasRaw)) throw createError({ statusCode: 400, statusMessage: 'linhas deve ser um array.' })
  if (linhasRaw.length === 0) throw createError({ statusCode: 400, statusMessage: 'Envie pelo menos uma linha.' })
  if (linhasRaw.length > MAX_LINHAS_POR_REQUISICAO) {
    throw createError({
      statusCode: 400,
      statusMessage: `No máximo ${MAX_LINHAS_POR_REQUISICAO} linhas por requisição.`,
    })
  }

  await checkWorkspace(event, workspaceId, userId)

  const admin = serverSupabaseServiceRole<any>(event)
  let codigoAtual = await maiorCodigoNoWorkspace(admin, workspaceId)

  const normalizadas: ProdutoCriarEmMassaLinha[] = []
  for (const item of linhasRaw) {
    const row = normalizarLinha(item)
    if (!row) {
      throw createError({ statusCode: 400, statusMessage: 'Cada linha deve ter `nome` (texto não vazio).' })
    }
    normalizadas.push(row)
  }

  const parentIds = new Set<number>()
  let produtosPaiNovos = 0
  for (const r of normalizadas) {
    if (r.parent_id != null && r.parent_id > 0) parentIds.add(r.parent_id)
    else produtosPaiNovos += 1
  }

  if (produtosPaiNovos > 0) {
    await checkLimiteProdutos(event, workspaceId, produtosPaiNovos)
  }

  if (parentIds.size > 0) {
    const { data: pais, error: errPais } = await admin
      .from('produtos_workspace')
      .select('id')
      .eq('workspace_id', workspaceId)
      .in('id', [...parentIds])
      .is('parent_id', null)

    if (errPais) throw createError({ statusCode: 500, statusMessage: errPais.message })

    const idsValidos = new Set((pais ?? []).map((p: { id: number }) => p.id))
    for (const pid of parentIds) {
      if (!idsValidos.has(pid)) {
        throw createError({
          statusCode: 400,
          statusMessage: `Produto pai inválido (id ${pid}).`,
        })
      }
    }
  }

  const insertRows = normalizadas.map((r) => {
    codigoAtual += 1
    return {
      workspace_id: workspaceId,
      codigo: codigoAtual,
      nome: r.nome,
      sku: r.sku ?? null,
      unidade_venda: r.unidade_venda ?? null,
      marca: r.marca ?? null,
      preco: r.preco ?? 0,
      preco_custo: r.preco_custo ?? 0,
      preco_promocional: r.preco_promocional ?? null,
      preco_prazo: r.preco_prazo ?? null,
      peso_kg: r.peso_kg ?? null,
      estoque: r.estoque ?? null,
      imagem_url: r.imagem_url ?? null,
      infos_relevantes: r.infos_relevantes ?? null,
      status: r.status ?? true,
      categoria_id: r.categoria_id ?? null,
      codigo_ncm: r.codigo_ncm ?? null,
      termo_pesquisa: r.termo_pesquisa ?? null,
      codigo_barras_ean: r.codigo_barras_ean ?? null,
      largura: r.largura ?? 0,
      altura: r.altura ?? 0,
      comprimento: r.comprimento ?? 0,
      parent_id: r.parent_id ?? null,
      tem_variacoes: false,
    }
  })

  const { error } = await admin.from('produtos_workspace').insert(insertRows)
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  if (parentIds.size > 0) {
    const { error: errFlag } = await admin
      .from('produtos_workspace')
      .update({ tem_variacoes: true })
      .eq('workspace_id', workspaceId)
      .in('id', [...parentIds])

    if (errFlag) throw createError({ statusCode: 500, statusMessage: errFlag.message })
  }

  return { inseridos: insertRows.length }
})

