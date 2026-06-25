import type { ProdutoTermoPesquisaItem, ProdutoWorkspaceItem } from '#shared/types/produtos'
import { normalizarTextoCategoriaUnica } from '#shared/utils/normalizarTextoCategoriaUnica'

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

/** Importação: célula inteira vira um termo (trim + maiúsculas, sem split). */
export function normalizarTermoImportacao(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const t = String(raw).trim()
  return t.length ? t.toLocaleUpperCase('pt-BR') : null
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

  const { data: produtos, error: pErr } = await admin
    .from('produtos_workspace')
    .select('id, termo_pesquisa')
    .eq('workspace_id', workspaceId)
    .in('id', produtoIds)

  if (pErr) throw pErr
  if (!produtos?.length) return out

  const termoIds = [...new Set(produtos.map((p: any) => p.termo_pesquisa).filter((id: unknown): id is number => typeof id === 'number' && id > 0))]
  
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

  for (const row of produtos) {
    const rec = row as { id?: unknown; termo_pesquisa?: unknown }
    const produtoId = typeof rec.id === 'number' ? rec.id : Number(rec.id)
    if (!Number.isFinite(produtoId)) continue
    
    const termoId = typeof rec.termo_pesquisa === 'number' ? rec.termo_pesquisa : Number(rec.termo_pesquisa)
    const termo = Number.isFinite(termoId) ? mapaTermos.get(termoId) : null
    
    out.set(produtoId, termo ? [termo] : [])
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
