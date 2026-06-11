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

/** Escapa `%` e `_` para `ilike` corresponder ao texto literal. */
export function escapeIlikeLiteral(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

/** Texto da coluna legada `produtos_workspace.termos_pesquisa` (nomes separados por espaço). */
export function formatTermosPesquisaTextoColuna(termos: ProdutoTermoPesquisaItem[]): string | null {
  const nomes = termos
    .map((t) => t.nome.trim())
    .filter((n) => n.length > 0)
    .sort((a, b) => a.localeCompare(b, 'pt', { sensitivity: 'base' }))
  return nomes.length ? nomes.join(' ') : null
}

export async function termosPesquisaTextoPorIds(
  admin: { from: (table: string) => any },
  workspaceId: number,
  termoIds: number[],
): Promise<string | null> {
  if (!termoIds.length) return null
  const { data, error } = await admin
    .from('produto_termo_de_pesquisa')
    .select('id, nome')
    .eq('workspace_id', workspaceId)
    .in('id', termoIds)
  if (error) throw error
  const termos = (data ?? []).map((row: Record<string, unknown>) => mapTermoPesquisaRow(row))
  return formatTermosPesquisaTextoColuna(termos)
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

export async function syncProdutoTermosPesquisa(
  admin: { from: (table: string) => any },
  workspaceId: number,
  produtoId: number,
  termoIds: number[],
): Promise<void> {
  const uniqInput = [...new Set(termoIds.filter((id) => Number.isInteger(id) && id >= 1))]
  const validos = await conjuntoIdsTermoValidos(admin, workspaceId, uniqInput)
  if (validos.size !== uniqInput.length) {
    throw new Error('termos_pesquisa_ids inválido ou não pertence a este workspace.')
  }
  const desejados = [...validos]

  const { data: atuais, error: selErr } = await admin
    .from('produto_termo_de_pesquisa_vinculo')
    .select('termo_id')
    .eq('produto_id', produtoId)
  if (selErr) throw selErr

  const atuaisSet = new Set<number>(
    (atuais ?? [])
      .map((r: { termo_id: unknown }) => Number(r.termo_id))
      .filter((id: number) => Number.isFinite(id)),
  )
  const desejadosSet = new Set(desejados)

  const remover = [...atuaisSet].filter((id) => !desejadosSet.has(id))
  const inserir = desejados.filter((id) => !atuaisSet.has(id))

  if (remover.length) {
    const { error: delErr } = await admin
      .from('produto_termo_de_pesquisa_vinculo')
      .delete()
      .eq('produto_id', produtoId)
      .in('termo_id', remover)
    if (delErr) throw delErr
  }

  if (inserir.length) {
    const rows = inserir.map((termo_id) => ({ produto_id: produtoId, termo_id }))
    const { error: insErr } = await admin.from('produto_termo_de_pesquisa_vinculo').insert(rows)
    if (insErr) throw insErr
  }

  const termosTexto = await termosPesquisaTextoPorIds(admin, workspaceId, desejados)
  const { error: upErr } = await admin
    .from('produtos_workspace')
    .update({
      termos_pesquisa: termosTexto,
      updated_at: new Date().toISOString(),
    })
    .eq('id', produtoId)
    .eq('workspace_id', workspaceId)
  if (upErr) throw upErr
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

  const { data: vinculos, error: vErr } = await admin
    .from('produto_termo_de_pesquisa_vinculo')
    .select('produto_id, termo_id')
    .in('produto_id', produtoIds)

  if (vErr) throw vErr
  if (!vinculos?.length) return out

  const termoIds = [...new Set(vinculos.map((v: { termo_id: unknown }) => Number(v.termo_id)).filter(Number.isFinite))]
  if (!termoIds.length) return out

  const { data: termos, error: tErr } = await admin
    .from('produto_termo_de_pesquisa')
    .select('id, nome')
    .eq('workspace_id', workspaceId)
    .in('id', termoIds)

  if (tErr) throw tErr

  const mapaTermos = new Map<number, ProdutoTermoPesquisaItem>()
  for (const row of termos ?? []) {
    const t = mapTermoPesquisaRow(row as Record<string, unknown>)
    if (t.id) mapaTermos.set(t.id, t)
  }

  for (const v of vinculos) {
    const rec = v as { produto_id: unknown; termo_id: unknown }
    const produtoId = Number(rec.produto_id)
    const termoId = Number(rec.termo_id)
    if (!Number.isFinite(produtoId) || !Number.isFinite(termoId)) continue
    const termo = mapaTermos.get(termoId)
    if (!termo) continue
    const lista = out.get(produtoId) ?? []
    if (!lista.some((x) => x.id === termo.id)) lista.push(termo)
    out.set(produtoId, lista)
  }

  for (const [pid, lista] of out) {
    lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt', { sensitivity: 'base' }))
    out.set(pid, lista)
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
