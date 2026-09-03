import type { ProdutoTermoPesquisaItem, ProdutoWorkspaceItem } from '#shared/types/produtos'
import { normalizarTextoCategoriaUnica } from '#shared/utils/normalizarTextoCategoriaUnica'
import {
  normalizarTermoImportacao,
  parseTermosImportacaoCelula,
} from '#shared/utils/parseTermosImportacaoCelula'

export { normalizarTermoImportacao, parseTermosImportacaoCelula }

export function mapTermoPesquisaRow(r: Record<string, unknown>): ProdutoTermoPesquisaItem {
  const id = typeof r.id === 'number' ? r.id : Number(r.id)
  const nomeRaw = String(r.nome ?? '').trim()
  return {
    id: Number.isFinite(id) ? id : 0,
    nome: nomeRaw.length ? nomeRaw.toLocaleUpperCase('pt-BR') : '',
  }
}

export function normalizarNomeTermoPesquisa(raw: string | null | undefined): string | null {
  return normalizarTextoCategoriaUnica(raw)
}

/** Escapa `%` e `_` para `ilike` corresponder ao texto literal. */
export function escapeIlikeLiteral(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

export type ObterOuCriarTermoResult = {
  data: ProdutoTermoPesquisaItem
  ja_existia: boolean
}

/**
 * Find-or-create em `produto_termo_de_pesquisa` (comparação ilike, nome canónico em maiúsculas).
 * `nomeNormalizado` deve já estar normalizado (maiúsculas).
 */
export async function obterOuCriarTermoPesquisa(
  admin: { from: (table: string) => any },
  workspaceId: number,
  nomeNormalizado: string,
): Promise<ObterOuCriarTermoResult> {
  const nome = nomeNormalizado.trim()
  const literal = escapeIlikeLiteral(nome)
  const { data: existente, error: selErr } = await admin
    .from('produto_termo_de_pesquisa')
    .select('id, nome')
    .eq('workspace_id', workspaceId)
    .ilike('nome', literal)
    .limit(1)
    .maybeSingle()

  if (selErr) throw selErr

  if (existente) {
    const rec = existente as Record<string, unknown>
    const id = typeof rec.id === 'number' ? rec.id : Number(rec.id)
    const nomeDb = String(rec.nome ?? '').trim()
    if (nomeDb.toLocaleUpperCase('pt-BR') !== nome) {
      const { error: upErr } = await admin.from('produto_termo_de_pesquisa').update({ nome }).eq('id', id)
      if (upErr) throw upErr
    }
    return {
      data: mapTermoPesquisaRow({ ...rec, nome }),
      ja_existia: true,
    }
  }

  const { data: inserted, error: insErr } = await admin
    .from('produto_termo_de_pesquisa')
    .insert({ workspace_id: workspaceId, nome })
    .select('id, nome')
    .single()

  if (insErr) throw insErr

  return {
    data: mapTermoPesquisaRow(inserted as Record<string, unknown>),
    ja_existia: false,
  }
}

/** Mapa `nome.toLowerCase()` → id para termos já existentes no workspace. */
export async function mapaNomeMinusculoParaTermoId(
  admin: { from: (table: string) => any },
  workspaceId: number,
): Promise<Map<string, number>> {
  const { data, error } = await admin
    .from('produto_termo_de_pesquisa')
    .select('id, nome')
    .eq('workspace_id', workspaceId)

  if (error) throw error

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

/** Mapa `nome.toLowerCase()` → item completo do catálogo. */
async function mapaNomeMinusculoParaTermoItem(
  admin: { from: (table: string) => any },
  workspaceId: number,
): Promise<Map<string, ProdutoTermoPesquisaItem>> {
  const { data, error } = await admin
    .from('produto_termo_de_pesquisa')
    .select('id, nome')
    .eq('workspace_id', workspaceId)

  if (error) throw error

  const map = new Map<string, ProdutoTermoPesquisaItem>()
  for (const row of data ?? []) {
    const t = mapTermoPesquisaRow(row as Record<string, unknown>)
    if (!t.nome.length) continue
    const chave = t.nome.toLowerCase()
    if (!map.has(chave)) map.set(chave, t)
  }
  return map
}

/**
 * Garante que todos os nomes do lote existem em `produto_termo_de_pesquisa`.
 * Retorna mapa `nome.toLowerCase()` → termo_id.
 */
export async function resolverTermosDoLoteImportacao(
  admin: { from: (table: string) => any },
  workspaceId: number,
  nomesUnicos: string[],
): Promise<Map<string, number>> {
  const mapa = await mapaNomeMinusculoParaTermoId(admin, workspaceId)

  for (const nome of nomesUnicos) {
    const chave = nome.trim().toLowerCase()
    if (!chave || mapa.has(chave)) continue
    const { data } = await obterOuCriarTermoPesquisa(admin, workspaceId, nome)
    if (data.id) mapa.set(chave, data.id)
  }

  return mapa
}

export async function conjuntoIdsTermoValidos(
  admin: { from: (table: string) => any },
  workspaceId: number,
  ids: number[],
): Promise<Set<number>> {
  const uniq = [...new Set(ids.filter((id) => Number.isInteger(id) && id >= 1))]
  if (!uniq.length) return new Set()
  const { data, error } = await admin
    .from('produto_termo_de_pesquisa')
    .select('id')
    .eq('workspace_id', workspaceId)
    .in('id', uniq)
  if (error) throw error
  const out = new Set<number>()
  for (const row of data ?? []) {
    const id = typeof row.id === 'number' ? row.id : Number(row.id)
    if (Number.isFinite(id)) out.add(id)
  }
  return out
}

/** Normaliza ids de termos vindos do body (array ou legado `termo_pesquisa` único). */
export function parseTermosPesquisaIdsInput(raw: unknown, legadoTermoId?: unknown): number[] {
  if (Array.isArray(raw)) {
    return [...new Set(
      raw
        .map((x) => (typeof x === 'number' ? Math.trunc(x) : Number.parseInt(String(x), 10)))
        .filter((n) => Number.isFinite(n) && n >= 1),
    )]
  }
  if (legadoTermoId !== undefined && legadoTermoId !== null && legadoTermoId !== '') {
    const n = typeof legadoTermoId === 'number' ? Math.trunc(legadoTermoId) : Number.parseInt(String(legadoTermoId), 10)
    if (Number.isFinite(n) && n >= 1) return [n]
  }
  return []
}

/**
 * Substitui vínculos do produto em `produto_termo_de_pesquisa_vinculo`.
 * `termoIds` vazio remove todos os vínculos.
 */
export async function sincronizarTermosVinculo(
  admin: { from: (table: string) => any },
  produtoId: number,
  termoIds: number[],
): Promise<void> {
  const uniq = [...new Set(termoIds.filter((id) => Number.isInteger(id) && id >= 1))]

  const { error: delErr } = await admin
    .from('produto_termo_de_pesquisa_vinculo')
    .delete()
    .eq('produto_id', produtoId)

  if (delErr) throw delErr
  if (!uniq.length) return

  const rows = uniq.map((termo_id) => ({ produto_id: produtoId, termo_id }))
  const { error: insErr } = await admin.from('produto_termo_de_pesquisa_vinculo').insert(rows)
  if (insErr) throw insErr
}

/** Aplica o mesmo conjunto de termos a vários produtos (edição em massa — só adiciona, não remove). */
export async function adicionarTermosVinculoEmMassa(
  admin: { from: (table: string) => any },
  produtoIds: number[],
  termoIds: number[],
): Promise<void> {
  const ids = [...new Set(produtoIds.filter((id) => Number.isInteger(id) && id >= 1))]
  if (!ids.length) return

  const uniqTermos = [...new Set(termoIds.filter((id) => Number.isInteger(id) && id >= 1))]
  if (!uniqTermos.length) return

  const rows: { produto_id: number; termo_id: number }[] = []
  for (const produto_id of ids) {
    for (const termo_id of uniqTermos) {
      rows.push({ produto_id, termo_id })
    }
  }

  await inserirTermosVinculoLote(admin, rows)
}

/** @deprecated use adicionarTermosVinculoEmMassa — mantido como alias add-only. */
export async function sincronizarTermosVinculoEmMassa(
  admin: { from: (table: string) => any },
  produtoIds: number[],
  termoIds: number[],
): Promise<void> {
  await adicionarTermosVinculoEmMassa(admin, produtoIds, termoIds)
}

/** Insere vínculos produto↔termo após create/import (ignora pares duplicados). */
export async function inserirTermosVinculoLote(
  admin: { from: (table: string) => any },
  pares: { produto_id: number; termo_id: number }[],
): Promise<void> {
  if (!pares.length) return
  const seen = new Set<string>()
  const rows: { produto_id: number; termo_id: number }[] = []
  for (const p of pares) {
    if (!Number.isFinite(p.produto_id) || !Number.isFinite(p.termo_id) || p.produto_id < 1 || p.termo_id < 1) {
      continue
    }
    const k = `${p.produto_id}:${p.termo_id}`
    if (seen.has(k)) continue
    seen.add(k)
    rows.push(p)
  }
  if (!rows.length) return
  const { error } = await admin.from('produto_termo_de_pesquisa_vinculo').upsert(rows, {
    onConflict: 'produto_id,termo_id',
    ignoreDuplicates: true,
  })
  if (error) throw error
}

function coletarIdsProdutos(items: ProdutoWorkspaceItem[]): number[] {
  const ids = new Set<number>()
  for (const pai of items) {
    ids.add(pai.id)
    for (const v of pai.variacoes ?? []) ids.add(v.id)
  }
  return [...ids]
}

export async function mapaTermosPorProdutoId(
  admin: { from: (table: string) => any },
  workspaceId: number,
  produtoIds: number[],
): Promise<Map<number, ProdutoTermoPesquisaItem[]>> {
  const out = new Map<number, ProdutoTermoPesquisaItem[]>()
  if (!produtoIds.length) return out

  for (const id of produtoIds) out.set(id, [])

  const { data: vinculos, error: vErr } = await admin
    .from('produto_termo_de_pesquisa_vinculo')
    .select('produto_id, termo_id')
    .in('produto_id', produtoIds)

  if (vErr) throw vErr
  if (!vinculos?.length) return out

  const termoIds = [
    ...new Set(
      vinculos
        .map((v: { termo_id?: unknown }) =>
          typeof v.termo_id === 'number' ? v.termo_id : Number(v.termo_id),
        )
        .filter((n: number) => Number.isFinite(n) && n >= 1),
    ),
  ]

  const mapaTermos = new Map<number, ProdutoTermoPesquisaItem>()
  if (termoIds.length > 0) {
    const { data: termos, error: tErr } = await admin
      .from('produto_termo_de_pesquisa')
      .select('id, nome')
      .eq('workspace_id', workspaceId)
      .in('id', termoIds)

    if (tErr) throw tErr

    for (const row of termos ?? []) {
      const t = mapTermoPesquisaRow(row as Record<string, unknown>)
      if (t.id) mapaTermos.set(t.id, t)
    }
  }

  for (const row of vinculos) {
    const rec = row as { produto_id?: unknown; termo_id?: unknown }
    const produtoId = typeof rec.produto_id === 'number' ? rec.produto_id : Number(rec.produto_id)
    const termoId = typeof rec.termo_id === 'number' ? rec.termo_id : Number(rec.termo_id)
    if (!Number.isFinite(produtoId) || !Number.isFinite(termoId)) continue

    const termo = mapaTermos.get(termoId)
    if (!termo) continue

    const lista = out.get(produtoId) ?? []
    if (!lista.some((x) => x.id === termo.id)) lista.push(termo)
    lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt', { sensitivity: 'base' }))
    out.set(produtoId, lista)
  }

  return out
}

export async function enrichProdutosComTermosPesquisa(
  admin: { from: (table: string) => any },
  workspaceId: number,
  items: ProdutoWorkspaceItem[],
): Promise<ProdutoWorkspaceItem[]> {
  const ids = coletarIdsProdutos(items)
  const mapa = await mapaTermosPorProdutoId(admin, workspaceId, ids)

  return items.map((pai) => ({
    ...pai,
    termos_pesquisa: mapa.get(pai.id) ?? [],
    variacoes: (pai.variacoes ?? []).map((v) => ({
      ...v,
      termos_pesquisa: mapa.get(v.id) ?? [],
    })),
  }))
}

export async function termosDoProduto(
  admin: { from: (table: string) => any },
  workspaceId: number,
  produtoId: number,
): Promise<ProdutoTermoPesquisaItem[]> {
  const mapa = await mapaTermosPorProdutoId(admin, workspaceId, [produtoId])
  return mapa.get(produtoId) ?? []
}
