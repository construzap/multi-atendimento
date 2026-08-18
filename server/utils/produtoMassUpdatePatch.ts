import { createError } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { normalizarTextoCategoriaUnica } from '#shared/utils/normalizarTextoCategoriaUnica'
import { conjuntoIdsTermoValidos } from './produtoTermosPesquisa'

/** Campos permitidos em `PATCH /api/produtos/atualizar-em-massa`. */
export const PRODUTO_MASS_PATCH_ALLOWED = new Set([
  'unidade_venda',
  'marca',
  'preco',
  'preco_custo',
  'preco_promocional',
  'preco_prazo',
  'infos_relevantes',
  'status',
  'envia_foto',
  'termos_pesquisa_ids',
  'categoria',
  'categoria_id',
])

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

export type MassUpdateBuildResult = {
  update: Record<string, unknown>
}

/**
 * Monta o objeto de `UPDATE` para edição em massa (mesmo patch em vários ids).
 * Lança `createError` em validação inválida.
 */
export async function buildProdutoMassUpdateFromPatch(
  admin: ReturnType<typeof serverSupabaseServiceRole<any>>,
  workspaceId: number,
  rawPatch: Record<string, unknown>,
): Promise<MassUpdateBuildResult> {
  const keys = Object.keys(rawPatch)
  for (const k of keys) {
    if (!PRODUTO_MASS_PATCH_ALLOWED.has(k)) {
      throw createError({ statusCode: 400, statusMessage: `Campo não permitido no patch em massa: ${k}.` })
    }
  }
  if (keys.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'O patch não pode ser vazio.' })
  }

  const p = rawPatch
  const update: Record<string, unknown> = {}

  if (p.unidade_venda !== undefined) update.unidade_venda = strOrNull(p.unidade_venda)
  if (p.marca !== undefined) update.marca = strOrNull(p.marca)
  if (p.infos_relevantes !== undefined) update.infos_relevantes = strOrNull(p.infos_relevantes)

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

  if (p.status !== undefined) {
    const b = boolFromUnknown(p.status)
    if (b === undefined) {
      throw createError({ statusCode: 400, statusMessage: 'Status inválido.' })
    }
    update.status = b
  }

  if (p.envia_foto !== undefined) {
    const b = boolFromUnknown(p.envia_foto)
    if (b === undefined) {
      throw createError({ statusCode: 400, statusMessage: 'envia_foto inválido.' })
    }
    update.envia_foto = b
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

  let termosIdsPatch: number[] | undefined
  if (p.termos_pesquisa_ids !== undefined) {
    if (!Array.isArray(p.termos_pesquisa_ids)) {
      throw createError({ statusCode: 400, statusMessage: 'termos_pesquisa_ids deve ser um array.' })
    }
    termosIdsPatch = p.termos_pesquisa_ids
      .map((x) => (typeof x === 'number' ? Math.trunc(x) : Number.parseInt(String(x), 10)))
      .filter((n) => Number.isFinite(n) && n >= 1)
    if (termosIdsPatch.length > 1) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Cada produto pode ter no máximo um termo de pesquisa.',
      })
    }
  }

  if (termosIdsPatch !== undefined) {
    if (termosIdsPatch.length === 0) {
      update.termo_pesquisa = null
    } else {
      const tid = termosIdsPatch[0]!
      const ok = await conjuntoIdsTermoValidos(admin, workspaceId, [tid])
      if (!ok.has(tid)) {
        throw createError({
          statusCode: 400,
          statusMessage: 'termos_pesquisa_ids inválido ou não pertence a este workspace.',
        })
      }
      update.termo_pesquisa = tid
    }
  }

  if (Object.keys(update).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Nenhum campo válido para atualizar.' })
  }

  return { update }
}

export function parseProdutoMassUpdateIds(raw: unknown, maxIds: number): number[] {
  if (!Array.isArray(raw)) {
    throw createError({ statusCode: 400, statusMessage: 'Envie `ids` como array de inteiros.' })
  }
  const out: number[] = []
  const seen = new Set<number>()
  for (const x of raw) {
    const n = typeof x === 'number' ? x : Number.parseInt(String(x ?? '').trim(), 10)
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) continue
    if (seen.has(n)) continue
    seen.add(n)
    out.push(n)
    if (out.length >= maxIds) break
  }
  if (out.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Informe pelo menos um id de produto válido.' })
  }
  return out
}
