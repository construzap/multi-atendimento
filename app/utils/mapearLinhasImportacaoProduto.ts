import type { ProdutoAtualizarPlanilhaLinha, ProdutoImportarLinha } from '#shared/types/produtos'
import { normalizarTextoCategoriaUnica } from '#shared/utils/normalizarTextoCategoriaUnica'
import { parseTermosImportacaoCelula } from '#shared/utils/parseTermosImportacaoCelula'
import { resolverPrecoPrazo } from '#shared/utils/resolverPrecoPrazo'
import type { CampoIaProdutoId } from '~/constants/produtosCamposIa'
import { CAMPOS_TABELA_IA_PRODUTO } from '~/constants/produtosCamposIa'
import { cellToString } from '~/utils/planilhaTexto'
import { converterPrecoPlanilha, type ConversaoPrecoId } from '~/utils/conversaoPrecoPlanilha'

function isCampoIaProdutoId(id: string): id is CampoIaProdutoId {
  return CAMPOS_TABELA_IA_PRODUTO.some((c) => c.id === id)
}

export function parseDecimalPtBr(raw: string): number | null {
  const s = raw.trim().replace(/\s/g, '')
  if (!s) return null
  let t = s.replace(/[^\d,.-]/g, '')
  if (!t) return null
  if (t.includes(',') && t.includes('.')) {
    const lastComma = t.lastIndexOf(',')
    const lastDot = t.lastIndexOf('.')
    if (lastComma > lastDot) {
      t = t.replace(/\./g, '').replace(',', '.')
    } else {
      t = t.replace(/,/g, '')
    }
  } else if (t.includes(',')) {
    t = t.replace(/\./g, '').replace(',', '.')
  }
  const n = Number.parseFloat(t)
  return Number.isFinite(n) ? n : null
}

function parseStatus(raw: string): boolean {
  const s = raw.trim().toLowerCase()
  if (!s) return true
  if (['0', 'n', 'nao', 'não', 'false', 'f', 'inativo', 'inactive', 'off'].includes(s)) return false
  if (['1', 's', 'sim', 'true', 't', 'ativo', 'active', 'on', 'yes'].includes(s)) return true
  return true
}

function precoDaCelula(rawCell: unknown, conversao: ConversaoPrecoId): number | null {
  return converterPrecoPlanilha(rawCell, conversao)
}

function valorCelulaParaCampo(field: CampoIaProdutoId, rawCell: unknown, conversao: ConversaoPrecoId = 'padrao'): unknown {
  const str = cellToString(rawCell)
  switch (field) {
    case 'nome':
      return str.trim() || null
    case 'termos_pesquisa':
      return parseTermosImportacaoCelula(str)
    case 'preco': {
      const n = precoDaCelula(rawCell, conversao)
      return n ?? 0
    }
    case 'preco_prazo': {
      const n = precoDaCelula(rawCell, conversao)
      return n
    }
    case 'peso_kg':
    case 'estoque': {
      const n = parseDecimalPtBr(str)
      return n
    }
    case 'status':
      return parseStatus(str)
    default:
      return str.length ? str : null
  }
}

/**
 * Constrói linhas para `POST /api/produtos/importar` a partir da matriz da folha (linha 0 = cabeçalho).
 * Ignora linhas sem `nome` após mapeamento.
 */
export function construirLinhasImportacaoProduto(
  todasLinhas: unknown[][],
  mapeamentoPorIndice: Record<number, string>,
  conversoesPorIndice: Record<number, ConversaoPrecoId> = {},
): ProdutoImportarLinha[] {
  if (todasLinhas.length < 2) return []

  const out: ProdutoImportarLinha[] = []

  for (let r = 1; r < todasLinhas.length; r++) {
    const row = todasLinhas[r]
    if (!Array.isArray(row)) continue
    const obj: Partial<ProdutoImportarLinha> = {}
    for (const [idxStr, fieldId] of Object.entries(mapeamentoPorIndice)) {
      const idx = Number(idxStr)
      if (!Number.isFinite(idx) || idx < 0 || !fieldId) continue
      if (!isCampoIaProdutoId(fieldId)) continue
      const field = fieldId
      const conversao = conversoesPorIndice[idx] ?? 'padrao'
      const val = valorCelulaParaCampo(field, row[idx], conversao)
      if (field === 'nome') {
        if (typeof val === 'string' && val.trim()) obj.nome = val.trim()
      } else {
        ;(obj as Record<string, unknown>)[field] = val
      }
    }
    const nome = (obj.nome ?? '').trim()
    if (!nome) continue
    const termos = Array.isArray(obj.termos_pesquisa)
      ? obj.termos_pesquisa
      : parseTermosImportacaoCelula(obj.termos_pesquisa)
    const codigo = typeof obj.codigo === 'string' ? obj.codigo.trim() : ''
    const barras = typeof obj.codigo_barras_ean === 'string' ? obj.codigo_barras_ean.trim() : ''
    out.push({
      nome,
      codigo: codigo.length ? codigo : null,
      codigo_barras_ean: barras.length ? barras : null,
      categoria: normalizarTextoCategoriaUnica((obj.categoria as string | null) ?? null),
      sku: (obj.sku as string | null) ?? null,
      unidade_venda: (obj.unidade_venda as string | null) ?? null,
      marca: (obj.marca as string | null) ?? null,
      preco: typeof obj.preco === 'number' ? obj.preco : null,
      preco_prazo: resolverPrecoPrazo(
        typeof obj.preco === 'number' ? obj.preco : null,
        typeof obj.preco_prazo === 'number' ? obj.preco_prazo : null,
      ),
      peso_kg: typeof obj.peso_kg === 'number' ? obj.peso_kg : null,
      estoque: typeof obj.estoque === 'number' ? obj.estoque : null,
      imagem_url: (obj.imagem_url as string | null) ?? null,
      infos_relevantes: (obj.infos_relevantes as string | null) ?? null,
      status: typeof obj.status === 'boolean' ? obj.status : true,
      termos_pesquisa: termos.length ? termos : null,
    })
  }

  return out
}

/** Verifica se existe pelo menos uma coluna mapeada para `nome`. */
export function mapeamentoTemNome(mapeamentoPorIndice: Record<number, string>): boolean {
  return Object.values(mapeamentoPorIndice).some((v) => v === 'nome')
}

function celulaPreenchida(rawCell: unknown): string {
  return cellToString(rawCell).trim()
}

/**
 * Linhas para `POST /api/produtos/planilha/atualizar-por-codigo` ou `atualizar-por-codigo-barras`.
 * Ignora células vazias e linhas sem código nem código de barras.
 */
export function construirLinhasAtualizacaoProduto(
  todasLinhas: unknown[][],
  mapeamentoPorIndice: Record<number, string>,
  conversoesPorIndice: Record<number, ConversaoPrecoId> = {},
): ProdutoAtualizarPlanilhaLinha[] {
  if (todasLinhas.length < 2) return []
  const prazoMapeado = Object.values(mapeamentoPorIndice).includes('preco_prazo')
  const out: ProdutoAtualizarPlanilhaLinha[] = []

  for (let r = 1; r < todasLinhas.length; r++) {
    const row = todasLinhas[r]
    if (!Array.isArray(row)) continue
    const obj: ProdutoAtualizarPlanilhaLinha = {}
    for (const [idxStr, fieldId] of Object.entries(mapeamentoPorIndice)) {
      const idx = Number(idxStr)
      if (!Number.isFinite(idx) || idx < 0 || !fieldId) continue
      if (!isCampoIaProdutoId(fieldId)) continue
      const texto = celulaPreenchida(row[idx])
      if (!texto) continue
      if (fieldId === 'termos_pesquisa') {
        const termos = parseTermosImportacaoCelula(texto)
        if (termos.length) obj.termos_pesquisa = termos
        continue
      }
      if (fieldId === 'preco' || fieldId === 'preco_prazo') {
        const n = converterPrecoPlanilha(texto, conversoesPorIndice[idx] ?? 'padrao')
        if (n == null) continue
        obj[fieldId] = n
        continue
      }
      if (fieldId === 'peso_kg' || fieldId === 'estoque') {
        const n = parseDecimalPtBr(texto)
        if (n == null) continue
        obj[fieldId] = n
        continue
      }
      if (fieldId === 'status') {
        obj.status = parseStatus(texto)
        continue
      }
      if (fieldId === 'categoria') {
        const cat = normalizarTextoCategoriaUnica(texto)
        if (cat) obj.categoria = cat
        continue
      }
      if (fieldId === 'nome' || fieldId === 'codigo' || fieldId === 'codigo_barras_ean' || fieldId === 'sku' || fieldId === 'unidade_venda' || fieldId === 'marca' || fieldId === 'imagem_url' || fieldId === 'infos_relevantes') {
        obj[fieldId] = texto
      }
    }
    if (!prazoMapeado && typeof obj.preco === 'number') obj.preco_prazo = obj.preco
    const codigo = (obj.codigo ?? '').trim()
    const barras = (obj.codigo_barras_ean ?? '').trim()
    if (!codigo && !barras) continue
    out.push(obj)
  }

  return out
}

export function mapeamentoTemCodigoOuBarras(mapeamentoPorIndice: Record<number, string>): boolean {
  return Object.values(mapeamentoPorIndice).some((v) => v === 'codigo' || v === 'codigo_barras_ean')
}

/** Atualização da planilha usa só um identificador. `null` quando não há nenhum ou quando os dois estão mapeados. */
export function chaveMapeamentoAtualizacaoProduto(
  mapeamentoPorIndice: Record<number, string>,
): 'codigo' | 'barras' | null {
  const valores = Object.values(mapeamentoPorIndice)
  const temCodigo = valores.includes('codigo')
  const temBarras = valores.includes('codigo_barras_ean')
  if (temCodigo === temBarras) return null
  return temBarras ? 'barras' : 'codigo'
}
