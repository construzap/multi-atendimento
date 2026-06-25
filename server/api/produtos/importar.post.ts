import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import type { ProdutoImportarLinha, ProdutosImportarLoteResponse } from '#shared/types/produtos'
import { normalizarTextoCategoriaUnica } from '#shared/utils/normalizarTextoCategoriaUnica'
import {
  normalizarTermoImportacao,
  resolverTermosDoLoteImportacao,
} from '../../utils/produtoTermosPesquisa'
import { checkWorkspace } from '../../utils/checkWorkspace'
import { getAuthUserId } from '../../utils/getAuthUserId'

const MAX_LINHAS_POR_REQUISICAO = 100

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

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }
  const raw = data?.codigo
  if (raw === undefined || raw === null) return 0
  const n = intOrNull(raw)
  return n != null && n > 0 ? n : 0
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

function normalizarLinha(raw: unknown): ProdutoImportarLinha | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const nome = strOrNull(o.nome)
  if (!nome) return null
  const cid = intOrNull(o.categoria_id)
  const linha: ProdutoImportarLinha = {
    nome,
    sku: strOrNull(o.sku),
    unidade_venda: strOrNull(o.unidade_venda),
    marca: strOrNull(o.marca),
    preco: numOrNull(o.preco) ?? 0,
    preco_prazo: numOrNull(o.preco_prazo),
    peso_kg: numOrNull(o.peso_kg),
    estoque: numOrNull(o.estoque),
    imagem_url: strOrNull(o.imagem_url),
    infos_relevantes: strOrNull(o.infos_relevantes),
    status: boolDefault(o.status, true),
  }
  if (cid != null && cid > 0) {
    linha.categoria_id = cid
  } else {
    const catNome = normalizarTextoCategoriaUnica(strOrNull(o.categoria))
    if (catNome) linha.categoria = catNome
  }
  const termo = normalizarTermoImportacao(strOrNull(o.termos_pesquisa))
  if (termo) linha.termos_pesquisa = termo
  return linha
}

async function mapaNomeMinusculoParaCategoriaId(
  admin: ReturnType<typeof serverSupabaseServiceRole<any>>,
  workspaceId: number,
): Promise<Map<string, number>> {
  const { data, error } = await admin
    .from('produto_categorias')
    .select('id, nome')
    .eq('workspace_id', workspaceId)
    .eq('ativo', true)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const map = new Map<string, number>()
  for (const row of data ?? []) {
    const rec = row as { id?: unknown; nome?: unknown }
    const nome = String(rec.nome ?? '').trim().toLowerCase()
    if (!nome) continue
    const id = typeof rec.id === 'number' ? rec.id : Number(rec.id)
    if (!Number.isFinite(id)) continue
    if (!map.has(nome)) map.set(nome, id)
  }
  return map
}

async function conjuntoIdsCategoriaValidos(
  admin: ReturnType<typeof serverSupabaseServiceRole<any>>,
  workspaceId: number,
  ids: number[],
): Promise<Set<number>> {
  const uniq = [...new Set(ids.filter((x) => Number.isInteger(x) && x > 0))]
  if (!uniq.length) return new Set()
  const { data, error } = await admin
    .from('produto_categorias')
    .select('id')
    .eq('workspace_id', workspaceId)
    .in('id', uniq)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }
  return new Set(
    (data ?? [])
      .map((r: { id?: unknown }) => (typeof r.id === 'number' ? r.id : Number(r.id)))
      .filter((n: number) => Number.isFinite(n)),
  )
}

/**
 * POST /api/produtos/importar
 *
 * Body: `{ workspace_id, linhas }` — até {@link MAX_LINHAS_POR_REQUISICAO} linhas por pedido.
 * Também serve para criar um único produto (ex.: modal «Novo») com `linhas` de um elemento.
 * Insere em `produtos_workspace` com `codigo` inteiro gerado (maior `codigo` existente no workspace + 1, +2, … neste lote).
 * `categoria_id` explícito (validado) ou texto em `categoria` (nome único, case-insensitive) resolvido para id.
 * `termos_pesquisa`: texto integral da célula → find-or-create em `produto_termo_de_pesquisa` + FK `termo_pesquisa` em `produtos_workspace`.
 * Texto com vários valores separados por `;` `,` ou `|` usa só o primeiro (categoria).
 * Não apaga nem atualiza linhas existentes.
 */
export default defineEventHandler(async (event): Promise<ProdutosImportarLoteResponse> => {
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

  const body = (await readBody<Body>(event).catch(() => null)) ?? {}
  const workspaceId = parseWorkspaceId(body.workspace_id)
  const linhasRaw = body.linhas

  if (!Array.isArray(linhasRaw)) {
    throw createError({ statusCode: 400, statusMessage: 'linhas deve ser um array.' })
  }
  if (linhasRaw.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Envie pelo menos uma linha.' })
  }
  if (linhasRaw.length > MAX_LINHAS_POR_REQUISICAO) {
    throw createError({
      statusCode: 400,
      statusMessage: `No máximo ${MAX_LINHAS_POR_REQUISICAO} linhas por requisição.`,
    })
  }

  await checkWorkspace(event, workspaceId, userId)

  const admin = serverSupabaseServiceRole<any>(event)
  let codigoAtual = await maiorCodigoNoWorkspace(admin, workspaceId)

  const normalizadas: ProdutoImportarLinha[] = []
  for (const item of linhasRaw) {
    const row = normalizarLinha(item)
    if (!row) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Cada linha deve ter `nome` (texto não vazio).',
      })
    }
    normalizadas.push(row)
  }

  const idsExplicitos = normalizadas
    .map((r) => r.categoria_id)
    .filter((x): x is number => x != null && x > 0)
  const idsOk = await conjuntoIdsCategoriaValidos(admin, workspaceId, idsExplicitos)
  const nomeParaId = await mapaNomeMinusculoParaCategoriaId(admin, workspaceId)

  const nomesTermosUnicos = [
    ...new Set(
      normalizadas
        .map((r) => r.termos_pesquisa?.trim())
        .filter((n): n is string => Boolean(n?.length)),
    ),
  ]
  if (nomesTermosUnicos.length > 0) {
    await resolverTermosDoLoteImportacao(admin, workspaceId, nomesTermosUnicos)
  }

  function resolverCategoriaId(r: ProdutoImportarLinha): number | null {
    const cid = r.categoria_id
    if (cid != null && cid > 0) {
      if (!idsOk.has(cid)) {
        throw createError({
          statusCode: 400,
          statusMessage: 'categoria_id inválido ou não pertence a este workspace.',
        })
      }
      return cid
    }
    const nome = (r.categoria ?? '').trim().toLowerCase()
    if (!nome) return null
    return nomeParaId.get(nome) ?? null
  }

  const insertRows = normalizadas.map((r) => {
    codigoAtual += 1
    const termoNome = r.termos_pesquisa?.trim() || null
    const termoId = termoNome ? termoIdPorNome.get(termoNome.toLowerCase()) ?? null : null
    return {
      workspace_id: workspaceId,
      codigo: codigoAtual,
      nome: r.nome,
      categoria_id: resolverCategoriaId(r),
      termo_pesquisa: termoId,
      sku: r.sku ?? null,
      unidade_venda: r.unidade_venda ?? null,
      marca: r.marca ?? null,
      preco: r.preco ?? 0,
      preco_prazo: r.preco_prazo ?? null,
      peso_kg: r.peso_kg ?? null,
      estoque: r.estoque ?? null,
      imagem_url: r.imagem_url ?? null,
      infos_relevantes: r.infos_relevantes ?? null,
      status: r.status ?? true,
    }
  })

  const { error } = await admin.from('produtos_workspace').insert(insertRows)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return { inseridos: insertRows.length }
})
