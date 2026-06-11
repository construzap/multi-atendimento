import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import type { ProdutoAtualizarResponse } from '#shared/types/produtos'
import { normalizarTextoCategoriaUnica } from '#shared/utils/normalizarTextoCategoriaUnica'
import { mapProdutoWorkspaceRow, SELECT_PRODUTO_WORKSPACE_EMBED } from '../../utils/produtoWorkspaceRow'
import { syncProdutoTermosPesquisa, termosDoProduto } from '../../utils/produtoTermosPesquisa'
import { checkWorkspace } from '../../utils/checkWorkspace'
import { getAuthUserId } from '../../utils/getAuthUserId'

type Body = {
  workspace_id?: unknown
  id?: unknown
  patch?: unknown
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

function boolFromUnknown(v: unknown): boolean | undefined {
  if (v === undefined) return undefined
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v !== 0
  const s = String(v).trim().toLowerCase()
  if (['0', 'n', 'nao', 'não', 'false', 'f', 'inativo', 'inactive', 'off'].includes(s)) return false
  if (['1', 's', 'sim', 'true', 't', 'ativo', 'active', 'on', 'yes'].includes(s)) return true
  return undefined
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
 * PATCH /api/produtos/atualizar
 * Body: `{ workspace_id, id, patch }` — `patch` parcial com campos permitidos de `produtos_workspace`.
 */
export default defineEventHandler(async (event): Promise<ProdutoAtualizarResponse> => {
  assertMethod(event, 'PATCH')

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
  const workspaceId = parsePositiveInt(body.workspace_id, 'workspace_id')
  const produtoId = parsePositiveInt(body.id, 'id')

  const rawPatch = body.patch
  if (!rawPatch || typeof rawPatch !== 'object' || Array.isArray(rawPatch)) {
    throw createError({ statusCode: 400, statusMessage: 'Envie um objeto `patch` com os campos a alterar.' })
  }

  const p = rawPatch as Record<string, unknown>
  const keys = Object.keys(p)
  const allowed = new Set([
    'nome',
    'codigo',
    'sku',
    'unidade_venda',
    'marca',
    'preco',
    'preco_custo',
    'preco_promocional',
    'preco_prazo',
    'peso_kg',
    'estoque',
    'infos_relevantes',
    'imagem_url',
    'codigo_ncm',
    'termos_pesquisa_ids',
    'codigo_barras_ean',
    'largura',
    'altura',
    'comprimento',
    'status',
    'categoria',
    'categoria_id',
  ])
  for (const k of keys) {
    if (!allowed.has(k)) {
      throw createError({ statusCode: 400, statusMessage: `Campo não permitido no patch: ${k}.` })
    }
  }
  if (keys.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'O patch não pode ser vazio.' })
  }

  await checkWorkspace(event, workspaceId, userId)

  const admin = serverSupabaseServiceRole<any>(event)

  const { data: existente, error: exErr } = await admin
    .from('produtos_workspace')
    .select('id')
    .eq('id', produtoId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (exErr) {
    throw createError({ statusCode: 500, statusMessage: exErr.message })
  }
  if (!existente) {
    throw createError({ statusCode: 404, statusMessage: 'Produto não encontrado neste workspace.' })
  }

  const update: Record<string, unknown> = {}

  if (p.nome !== undefined) {
    const nome = strOrNull(p.nome)
    if (!nome) {
      throw createError({ statusCode: 400, statusMessage: 'O nome do produto não pode ser vazio.' })
    }
    update.nome = nome
  }

  if (p.codigo !== undefined) {
    const c = intOrNull(p.codigo)
    if (c == null || c < 1) {
      throw createError({ statusCode: 400, statusMessage: 'Código inválido (use um inteiro ≥ 1).' })
    }
    const { data: dup, error: dupErr } = await admin
      .from('produtos_workspace')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('codigo', c)
      .neq('id', produtoId)
      .maybeSingle()

    if (dupErr) {
      throw createError({ statusCode: 500, statusMessage: dupErr.message })
    }
    if (dup) {
      throw createError({ statusCode: 400, statusMessage: 'Este código já está em uso por outro produto no workspace.' })
    }
    update.codigo = c
  }

  if (p.sku !== undefined) update.sku = strOrNull(p.sku)
  if (p.unidade_venda !== undefined) update.unidade_venda = strOrNull(p.unidade_venda)
  if (p.marca !== undefined) update.marca = strOrNull(p.marca)
  if (p.infos_relevantes !== undefined) update.infos_relevantes = strOrNull(p.infos_relevantes)
  if (p.imagem_url !== undefined) update.imagem_url = strOrNull(p.imagem_url)

  if (p.preco !== undefined) {
    const preco = numOrNull(p.preco)
    if (preco == null || preco < 0) {
      throw createError({ statusCode: 400, statusMessage: 'Preço inválido.' })
    }
    update.preco = preco
  }

  if (p.preco_custo !== undefined) {
    const v = numOrNull(p.preco_custo)
    if (v == null || v < 0) {
      throw createError({ statusCode: 400, statusMessage: 'Preço de custo inválido.' })
    }
    update.preco_custo = v
  }

  if (p.preco_promocional !== undefined) {
    const v = numOrNull(p.preco_promocional)
    update.preco_promocional = v != null && v >= 0 ? v : null
  }

  if (p.preco_prazo !== undefined) {
    const v = numOrNull(p.preco_prazo)
    update.preco_prazo = v != null && v >= 0 ? v : null
  }

  if (p.peso_kg !== undefined) {
    const v = numOrNull(p.peso_kg)
    update.peso_kg = v != null && v >= 0 ? v : null
  }

  if (p.estoque !== undefined) {
    const v = numOrNull(p.estoque)
    update.estoque = v != null && v >= 0 ? v : null
  }

  if (p.codigo_ncm !== undefined) update.codigo_ncm = strOrNull(p.codigo_ncm)
  if (p.codigo_barras_ean !== undefined) update.codigo_barras_ean = strOrNull(p.codigo_barras_ean)

  let termosIdsPatch: number[] | undefined
  if (p.termos_pesquisa_ids !== undefined) {
    if (!Array.isArray(p.termos_pesquisa_ids)) {
      throw createError({ statusCode: 400, statusMessage: 'termos_pesquisa_ids deve ser um array.' })
    }
    termosIdsPatch = p.termos_pesquisa_ids
      .map((x) => (typeof x === 'number' ? Math.trunc(x) : Number.parseInt(String(x), 10)))
      .filter((n) => Number.isFinite(n) && n >= 1)
  }

  if (p.largura !== undefined) {
    const v = numOrNull(p.largura)
    if (v == null || v < 0) throw createError({ statusCode: 400, statusMessage: 'Largura inválida.' })
    update.largura = v
  }
  if (p.altura !== undefined) {
    const v = numOrNull(p.altura)
    if (v == null || v < 0) throw createError({ statusCode: 400, statusMessage: 'Altura inválida.' })
    update.altura = v
  }
  if (p.comprimento !== undefined) {
    const v = numOrNull(p.comprimento)
    if (v == null || v < 0) throw createError({ statusCode: 400, statusMessage: 'Comprimento inválido.' })
    update.comprimento = v
  }

  if (p.status !== undefined) {
    const b = boolFromUnknown(p.status)
    if (b === undefined) {
      throw createError({ statusCode: 400, statusMessage: 'Status inválido.' })
    }
    update.status = b
  }

  if (p.categoria_id !== undefined && p.categoria !== undefined) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Use apenas `categoria` (nome) ou `categoria_id`, não ambos.',
    })
  }

  if (p.categoria_id !== undefined) {
    const cid = intOrNull(p.categoria_id)
    if (cid == null) {
      update.categoria_id = null
    } else {
      const ok = await conjuntoIdsCategoriaValidos(admin, workspaceId, [cid])
      if (!ok.has(cid)) {
        throw createError({
          statusCode: 400,
          statusMessage: 'categoria_id inválido ou não pertence a este workspace.',
        })
      }
      update.categoria_id = cid
    }
  } else if (p.categoria !== undefined) {
    const catNome = normalizarTextoCategoriaUnica(strOrNull(p.categoria))
    if (!catNome) {
      update.categoria_id = null
    } else {
      const map = await mapaNomeMinusculoParaCategoriaId(admin, workspaceId)
      const idCat = map.get(catNome.toLowerCase())
      if (idCat == null) {
        throw createError({
          statusCode: 400,
          statusMessage: `Não existe categoria ativa com o nome «${catNome}» neste workspace.`,
        })
      }
      update.categoria_id = idCat
    }
  }

  if (Object.keys(update).length === 0 && termosIdsPatch === undefined) {
    throw createError({ statusCode: 400, statusMessage: 'Nenhum campo válido para atualizar.' })
  }

  if (termosIdsPatch !== undefined) {
    try {
      await syncProdutoTermosPesquisa(admin, workspaceId, produtoId, termosIdsPatch)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'termos_pesquisa_ids inválido.'
      throw createError({ statusCode: 400, statusMessage: msg })
    }
  }

  let updated: Record<string, unknown> | null = null

  if (Object.keys(update).length > 0) {
    // DEFAULT now() só no INSERT; em UPDATE é preciso definir explicitamente.
    update.updated_at = new Date().toISOString()

    const { data: upData, error: upErr } = await admin
      .from('produtos_workspace')
      .update(update)
      .eq('id', produtoId)
      .eq('workspace_id', workspaceId)
      .select(SELECT_PRODUTO_WORKSPACE_EMBED)
      .single()

    if (upErr) {
      throw createError({ statusCode: 500, statusMessage: upErr.message })
    }
    if (!upData || typeof upData !== 'object') {
      throw createError({ statusCode: 500, statusMessage: 'Resposta inválida ao atualizar produto.' })
    }
    updated = upData as Record<string, unknown>
  } else {
    const { data: cur, error: curErr } = await admin
      .from('produtos_workspace')
      .select(SELECT_PRODUTO_WORKSPACE_EMBED)
      .eq('id', produtoId)
      .eq('workspace_id', workspaceId)
      .single()
    if (curErr) {
      throw createError({ statusCode: 500, statusMessage: curErr.message })
    }
    if (!cur || typeof cur !== 'object') {
      throw createError({ statusCode: 404, statusMessage: 'Produto não encontrado.' })
    }
    updated = cur as Record<string, unknown>
  }

  const mapped = mapProdutoWorkspaceRow(updated)
  mapped.termos_pesquisa = await termosDoProduto(admin, workspaceId, produtoId)

  return {
    data: mapped,
  }
})
