import type { ProdutoWorkspaceItem } from '#shared/types/produtos'
import { normalizarTextoCategoriaUnica } from '#shared/utils/normalizarTextoCategoriaUnica'

/** Mesmo `select` embutido usado em listagem e após atualização. */
export const SELECT_PRODUTO_WORKSPACE_EMBED =
  'id, codigo, nome, categoria_id, sku, unidade_venda, marca, preco, preco_prazo, peso_kg, infos_relevantes, imagem_url, status, produto_categorias(nome)'

function extrairNomeCategoriaEmbutido(r: Record<string, unknown>): string | null {
  const rel = r.produto_categorias
  if (rel == null) return null
  if (Array.isArray(rel)) {
    const first = rel[0] as Record<string, unknown> | undefined
    if (!first) return null
    const n = first.nome
    return n == null ? null : String(n)
  }
  if (typeof rel === 'object') {
    const n = (rel as { nome?: unknown }).nome
    return n == null ? null : String(n)
  }
  return null
}

export function mapProdutoWorkspaceRow(r: Record<string, unknown>): ProdutoWorkspaceItem {
  const id = typeof r.id === 'number' ? r.id : Number(r.id)
  const codigo =
    r.codigo === null || r.codigo === undefined
      ? null
      : typeof r.codigo === 'number'
        ? r.codigo
        : Number.parseInt(String(r.codigo), 10)
  const catIdRaw = r.categoria_id
  const categoria_id =
    catIdRaw === null || catIdRaw === undefined
      ? null
      : typeof catIdRaw === 'number'
        ? catIdRaw
        : Number.parseInt(String(catIdRaw), 10)
  const preco =
    typeof r.preco === 'number' ? r.preco : Number.parseFloat(String(r.preco ?? '0')) || 0
  const precoPrazoRaw = r.preco_prazo
  const preco_prazo =
    precoPrazoRaw === null || precoPrazoRaw === undefined
      ? null
      : typeof precoPrazoRaw === 'number'
        ? precoPrazoRaw
        : Number.parseFloat(String(precoPrazoRaw))
  const pesoRaw = r.peso_kg
  const peso_kg =
    pesoRaw === null || pesoRaw === undefined
      ? null
      : typeof pesoRaw === 'number'
        ? pesoRaw
        : Number.parseFloat(String(pesoRaw))

  const categoria_nome = normalizarTextoCategoriaUnica(extrairNomeCategoriaEmbutido(r))

  return {
    id: Number.isFinite(id) ? id : 0,
    codigo: codigo != null && Number.isFinite(codigo) ? codigo : null,
    nome: String(r.nome ?? ''),
    categoria_id: categoria_id != null && Number.isFinite(categoria_id) ? categoria_id : null,
    categoria_nome,
    sku: r.sku == null ? null : String(r.sku),
    unidade_venda: r.unidade_venda == null ? null : String(r.unidade_venda),
    marca: r.marca == null ? null : String(r.marca),
    preco,
    preco_prazo: preco_prazo != null && Number.isFinite(preco_prazo) ? preco_prazo : null,
    peso_kg: peso_kg != null && Number.isFinite(peso_kg) ? peso_kg : null,
    infos_relevantes: r.infos_relevantes == null ? null : String(r.infos_relevantes),
    imagem_url: r.imagem_url == null ? null : String(r.imagem_url),
    status: Boolean(r.status),
  }
}
