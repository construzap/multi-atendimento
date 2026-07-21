import { createHash } from 'node:crypto'
import type { DocumentMetadata, ProdutoEmbeddingPayload } from '#shared/types/vectorStore'

const SELECT_VIEW =
  'id, workspace_id, nome, codigo, sku, unidade_venda, marca, preco, preco_prazo, peso_kg, estoque, infos_relevantes, imagem_url, imagens, status, descricao, termos_pesquisa, termos_pesquisa_busca, preco_custo, preco_promocional, codigo_barras_ean, parent_id, tem_variacoes, atributos, categoria, variacoes'

export { SELECT_VIEW as SELECT_VIEW_PRODUTOS_EMBEDDING }

function extrairTermosPesquisa(row: Record<string, unknown>): string | null {
  const busca = row.termos_pesquisa_busca
  if (typeof busca === 'string' && busca.trim()) return busca.trim()

  const termos = row.termos_pesquisa
  if (typeof termos === 'string' && termos.trim()) return termos.trim()
  if (termos != null && typeof termos === 'object' && !Array.isArray(termos)) {
    const n = (termos as { nome?: unknown }).nome
    if (n != null && String(n).trim()) return String(n).trim()
  }
  if (!Array.isArray(termos)) return null
  const nomes = termos
    .map((t) => {
      if (t == null || typeof t !== 'object') return ''
      const n = (t as { nome?: unknown }).nome
      return n == null ? '' : String(n).trim()
    })
    .filter(Boolean)
  return nomes.length ? nomes.join(' ') : null
}

function formatValor(val: unknown): string {
  if (val == null) return ''
  const s = String(val).trim()
  return s
}

function formatPreco(val: unknown): string {
  if (val == null) return ''
  const n = Number(val)
  if (!Number.isFinite(n)) return ''
  return n.toFixed(2)
}

/** URLs de `imagens` (json da view), ordenadas por `ordem`; fallback em `imagem_url`. */
export function extrairImagensUrls(row: Record<string, unknown>): string[] {
  const raw = row.imagens
  const ordenadas: { ordem: number; url: string }[] = []

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (item == null || typeof item !== 'object') continue
      const rec = item as Record<string, unknown>
      const imagemUrl = rec.imagem_url == null ? '' : String(rec.imagem_url).trim()
      const urlAlt = rec.url == null ? imagemUrl : String(rec.url).trim()
      const url = urlAlt || imagemUrl
      if (!url) continue
      const ordemRaw = rec.ordem == null ? 0 : Number(rec.ordem)
      ordenadas.push({
        ordem: Number.isFinite(ordemRaw) ? ordemRaw : 0,
        url,
      })
    }
  }

  if (ordenadas.length > 0) {
    ordenadas.sort((a, b) => a.ordem - b.ordem)
    return ordenadas.map((item) => item.url)
  }

  const legado = row.imagem_url
  if (legado != null && String(legado).trim()) return [String(legado).trim()]
  return []
}

/** Entrada do SHA-256: content + campos de metadata que disparam reindexação no sync. */
function buildContentHashInput(
  content: string,
  workspaceId: number,
  termosPesquisa: string | null,
  imagensUrls: string[],
): string {
  return [
    content,
    `termos_pesquisa:${termosPesquisa ?? ''}`,
    `workspace_id:${String(workspaceId)}`,
    `imagens_urls:${imagensUrls.join('|')}`,
  ].join('\n')
}

export function buildProdutoEmbeddingPayload(
  row: Record<string, unknown>,
  workspaceId: number,
): ProdutoEmbeddingPayload | null {
  if (!isProdutoIndexavel(row)) return null

  const id = Number(row.id)
  if (!Number.isFinite(id)) return null

  const nome = row.nome != null ? String(row.nome).trim() : ''
  if (!nome) return null

  const termoPesquisa = extrairTermosPesquisa(row)
  const codigo = formatValor(row.codigo)

  const content = [
    `Id: ${id}`,
    `Nome do produto: ${nome}`,
    `Unidade_Venda: ${formatValor(row.unidade_venda)}`,
    `Marca: ${formatValor(row.marca)}`,
    `Preço a vista: ${formatPreco(row.preco)}`,
    `Preço a Prazo: ${formatPreco(row.preco_prazo)}`,
    `Infos relevantes: ${formatValor(row.infos_relevantes)}`,
  ].join('  |  ')

  const imagensUrls = extrairImagensUrls(row)
  const contentHash = createHash('sha256')
    .update(buildContentHashInput(content, workspaceId, termoPesquisa, imagensUrls))
    .digest('hex')

  const metadata: DocumentMetadata = {
    loc: {
      lines: {
        from: 1,
        to: 1,
      },
    },
    source: 'blob',
    blobType: 'text/plain',
    termos_pesquisa: termoPesquisa ?? '',
    workspace_id: String(workspaceId),
    content_hash: contentHash,
    imagens_urls: imagensUrls,
  }

  return {
    produtoId: id,
    codigo,
    content,
    metadata,
    contentHash,
  }
}

/** Extrai o id do produto a partir do `content` indexado (`Id: 123  |  ...`). */
export function parseProdutoIdFromContent(content: string): string | null {
  const match = content.match(/^Id:\s*([^|]+?)\s*\|/)
  if (!match) return null
  const value = match[1]?.trim()
  return value || null
}

/** Produto ativo para indexação (`status` true); não entra no `content`. */
export function isProdutoStatusAtivo(status: unknown): boolean {
  if (status === true || status === 1) return true
  if (status === 'true' || status === '1') return true
  return false
}

export function isProdutoIndexavel(row: Record<string, unknown>): boolean {
  if (!isProdutoStatusAtivo(row.status)) return false
  const parentId = row.parent_id
  if (parentId != null && parentId !== '') return false
  return true
}
