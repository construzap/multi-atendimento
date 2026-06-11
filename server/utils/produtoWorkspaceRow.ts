import type {

  ProdutoImagemItem,

  ProdutoTermoPesquisaItem,

  ProdutoVariacaoItem,

  ProdutoWorkspaceCampos,

  ProdutoWorkspaceItem,

} from '#shared/types/produtos'

import { normalizarTextoCategoriaUnica } from '#shared/utils/normalizarTextoCategoriaUnica'



/** Mesmo `select` embutido usado após `PATCH /api/produtos/atualizar`. */

export const SELECT_PRODUTO_WORKSPACE_EMBED =

  'id, codigo, nome, categoria_id, sku, unidade_venda, marca, preco, preco_custo, preco_promocional, preco_prazo, peso_kg, estoque, infos_relevantes, imagem_url, codigo_ncm, termos_pesquisa, codigo_barras_ean, largura, altura, comprimento, status, produto_categorias(nome)'



/** Colunas da view `view_produtos_com_variacoes` usadas na listagem. */

export const SELECT_VIEW_PRODUTOS_COM_VARIACOES =

  'id, workspace_id, nome, sku, unidade_venda, marca, preco, preco_prazo, peso_kg, estoque, imagem_url, infos_relevantes, status, created_at, updated_at, codigo, categoria_id, descricao, codigo_ncm, termos_pesquisa, preco_custo, preco_promocional, codigo_barras_ean, largura, altura, comprimento, parent_id, tem_variacoes, atributos, categoria, imagens, variacoes'



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



function extrairNomeCategoriaJson(r: Record<string, unknown>): string | null {

  const cat = r.categoria

  if (cat == null) return null

  if (typeof cat === 'object' && !Array.isArray(cat)) {

    const n = (cat as { nome?: unknown }).nome

    return n == null ? null : String(n)

  }

  return null

}



function parseImagens(raw: unknown): ProdutoImagemItem[] {

  if (raw == null) return []

  if (!Array.isArray(raw)) return []

  return raw
    .filter((x) => x != null && typeof x === 'object')
    .map((x) => {
      const rec = x as Record<string, unknown>
      const imagem_url = rec.imagem_url == null ? null : String(rec.imagem_url)
      const url = rec.url == null ? imagem_url : String(rec.url)
      return { ...rec, imagem_url: imagem_url ?? url, url } as ProdutoImagemItem
    })

}



function urlPrimeiraImagem(imagens: ProdutoImagemItem[]): string | null {

  for (const img of imagens) {

    const u = img.imagem_url ?? img.url

    if (u != null && String(u).trim().length > 0) return String(u).trim()

  }

  return null

}



function parseAtributos(raw: unknown): Record<string, unknown> | null {

  if (raw == null) return null

  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>

  return null

}



function parseIntOrNull(raw: unknown): number | null {

  if (raw === null || raw === undefined) return null

  const n = typeof raw === 'number' ? Math.trunc(raw) : Number.parseInt(String(raw), 10)

  return Number.isFinite(n) ? n : null

}



function parseNum(raw: unknown, fallback = 0): number {

  if (typeof raw === 'number' && Number.isFinite(raw)) return raw

  const n = Number.parseFloat(String(raw ?? ''))

  return Number.isFinite(n) ? n : fallback

}



function parseNumOrNull(raw: unknown): number | null {

  if (raw === null || raw === undefined || raw === '') return null

  const n = typeof raw === 'number' ? raw : Number.parseFloat(String(raw).replace(',', '.'))

  return Number.isFinite(n) ? n : null

}



function parseTermosPesquisa(raw: unknown): ProdutoTermoPesquisaItem[] {
  if (raw == null) return []
  if (!Array.isArray(raw)) return []
  const out: ProdutoTermoPesquisaItem[] = []
  for (const item of raw) {
    if (item == null || typeof item !== 'object') continue
    const rec = item as Record<string, unknown>
    const id = typeof rec.id === 'number' ? rec.id : Number(rec.id)
    const nome = String(rec.nome ?? '').trim()
    if (!Number.isFinite(id) || id < 1 || !nome.length) continue
    out.push({ id, nome: nome.toLocaleUpperCase('pt-BR') })
  }
  out.sort((a, b) => a.nome.localeCompare(b.nome, 'pt', { sensitivity: 'base' }))
  return out
}



function mapCamposProduto(r: Record<string, unknown>): ProdutoWorkspaceCampos {

  const id = typeof r.id === 'number' ? r.id : Number(r.id)

  const codigo = parseIntOrNull(r.codigo)

  const categoria_id = parseIntOrNull(r.categoria_id)

  const parent_id = parseIntOrNull(r.parent_id)



  const imagens = parseImagens(r.imagens)

  const imagemLegada = r.imagem_url == null ? null : String(r.imagem_url).trim() || null

  const imagem_url = imagemLegada ?? urlPrimeiraImagem(imagens)



  const preco = parseNum(r.preco, 0)

  const preco_custo = parseNum(r.preco_custo, 0)

  const preco_promocional = parseNumOrNull(r.preco_promocional)

  const preco_prazo = parseNumOrNull(r.preco_prazo)

  const peso_kg = parseNumOrNull(r.peso_kg)

  const estoque = parseNumOrNull(r.estoque)



  const categoriaFromJson = extrairNomeCategoriaJson(r)

  const categoriaFromEmbed = extrairNomeCategoriaEmbutido(r)

  const categoria_nome = normalizarTextoCategoriaUnica(categoriaFromJson ?? categoriaFromEmbed)



  return {

    id: Number.isFinite(id) ? id : 0,

    codigo: codigo != null && codigo >= 1 ? codigo : null,

    nome: String(r.nome ?? ''),

    categoria_id: categoria_id != null && categoria_id >= 1 ? categoria_id : null,

    categoria_nome,

    sku: r.sku == null ? null : String(r.sku),

    unidade_venda: r.unidade_venda == null ? null : String(r.unidade_venda),

    marca: r.marca == null ? null : String(r.marca),

    preco,

    preco_custo,

    preco_promocional: preco_promocional != null && preco_promocional >= 0 ? preco_promocional : null,

    preco_prazo: preco_prazo != null && preco_prazo >= 0 ? preco_prazo : null,

    peso_kg: peso_kg != null && peso_kg >= 0 ? peso_kg : null,

    estoque: estoque != null && estoque >= 0 ? estoque : null,

    infos_relevantes: r.infos_relevantes == null ? null : String(r.infos_relevantes),

    imagem_url,

    descricao: r.descricao == null ? null : String(r.descricao),

    codigo_ncm: r.codigo_ncm == null ? null : String(r.codigo_ncm),

    termos_pesquisa: parseTermosPesquisa(r.termos_pesquisa),

    codigo_barras_ean: r.codigo_barras_ean == null ? null : String(r.codigo_barras_ean),

    largura: parseNum(r.largura, 0),

    altura: parseNum(r.altura, 0),

    comprimento: parseNum(r.comprimento, 0),

    status: Boolean(r.status),

    parent_id: parent_id != null && parent_id >= 1 ? parent_id : null,

    atributos: parseAtributos(r.atributos),

    imagens,

  }

}



function mapVariacaoRow(r: Record<string, unknown>): ProdutoVariacaoItem {

  const campos = mapCamposProduto(r)

  const pid = campos.parent_id

  return {

    ...campos,

    parent_id: pid != null && pid >= 1 ? pid : 0,

  }

}



/** Linha de `view_produtos_com_variacoes` (produto pai + variações agregadas). */

export function mapViewProdutoComVariacoesRow(r: Record<string, unknown>): ProdutoWorkspaceItem {

  const campos = mapCamposProduto(r)

  const rawVar = r.variacoes

  const variacoes: ProdutoVariacaoItem[] = Array.isArray(rawVar)

    ? rawVar

        .filter((x) => x != null && typeof x === 'object')

        .map((v) => mapVariacaoRow(v as Record<string, unknown>))

    : []



  return {

    ...campos,

    parent_id: null,

    tem_variacoes: Boolean(r.tem_variacoes),

    variacoes,

  }

}



/** Linha simples de `produtos_workspace` (PATCH / embed FK). */

export function mapProdutoWorkspaceRow(r: Record<string, unknown>): ProdutoWorkspaceItem {

  const campos = mapCamposProduto(r)

  return {

    ...campos,

    parent_id: null,

    tem_variacoes: false,

    variacoes: [],

  }

}


