import type { ProdutoImportarLinha } from '#shared/types/produtos'
import { normalizarTextoCategoriaUnica } from '#shared/utils/normalizarTextoCategoriaUnica'
import type { CampoIaProdutoId } from '~/constants/produtosCamposIa'
import { CAMPOS_TABELA_IA_PRODUTO } from '~/constants/produtosCamposIa'
import { cellToString } from '~/utils/extrairCabecalhosPlanilha'

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

function valorCelulaParaCampo(field: CampoIaProdutoId, rawCell: unknown): unknown {
  const str = cellToString(rawCell)
  switch (field) {
    case 'nome':
      return str.trim() || null
    case 'preco': {
      const n = parseDecimalPtBr(str)
      return n ?? 0
    }
    case 'preco_prazo':
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
      const val = valorCelulaParaCampo(field, row[idx])
      if (field === 'nome') {
        if (typeof val === 'string' && val.trim()) obj.nome = val.trim()
      } else {
        ;(obj as Record<string, unknown>)[field] = val
      }
    }
    const nome = (obj.nome ?? '').trim()
    if (!nome) continue
    out.push({
      nome,
      categoria: normalizarTextoCategoriaUnica((obj.categoria as string | null) ?? null),
      sku: (obj.sku as string | null) ?? null,
      unidade_venda: (obj.unidade_venda as string | null) ?? null,
      marca: (obj.marca as string | null) ?? null,
      preco: typeof obj.preco === 'number' ? obj.preco : 0,
      preco_prazo: typeof obj.preco_prazo === 'number' ? obj.preco_prazo : null,
      peso_kg: typeof obj.peso_kg === 'number' ? obj.peso_kg : null,
      estoque: typeof obj.estoque === 'number' ? obj.estoque : null,
      imagem_url: (obj.imagem_url as string | null) ?? null,
      infos_relevantes: (obj.infos_relevantes as string | null) ?? null,
      status: typeof obj.status === 'boolean' ? obj.status : true,
    })
  }

  return out
}

/** Verifica se existe pelo menos uma coluna mapeada para `nome`. */
export function mapeamentoTemNome(mapeamentoPorIndice: Record<number, string>): boolean {
  return Object.values(mapeamentoPorIndice).some((v) => v === 'nome')
}
