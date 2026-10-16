import { createHash } from 'node:crypto'
import type { TermoDocumentMetadata, TermoEmbeddingPayload } from '#shared/types/vectorStore'

function buildContentHashInput(content: string, workspaceId: number): string {
  return [content, `workspace_id:${String(workspaceId)}`].join('\n')
}

function parseProdutosJson(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

/** Nomes de `produtos` (json da view), na ordem já agregada (`v.ordem`, `p.id`). */
export function extrairNomesProdutos(row: Record<string, unknown>): string[] {
  const nomes: string[] = []
  const seen = new Set<string>()

  for (const item of parseProdutosJson(row.produtos)) {
    if (item == null || typeof item !== 'object') continue
    const nome = (item as { nome?: unknown }).nome
    const texto = nome == null ? '' : String(nome).trim()
    if (!texto) continue
    const chave = texto.toLocaleLowerCase('pt-BR')
    if (seen.has(chave)) continue
    seen.add(chave)
    nomes.push(texto)
  }

  return nomes
}

function buildTermoContent(nome: string, descricao: string | null, nomesProdutos: string[]): string {
  const partes = [nome]
  if (descricao) partes.push(descricao)
  if (nomesProdutos.length) partes.push(`Produtos:\n${nomesProdutos.join('\n')}`)
  return partes.join('\n\n')
}

export function buildTermoEmbeddingPayload(
  row: Record<string, unknown>,
  workspaceId: number,
): TermoEmbeddingPayload | null {
  const id = Number(row.id)
  if (!Number.isFinite(id)) return null

  const nome = row.nome != null ? String(row.nome).trim() : ''
  if (!nome) return null

  const descricaoRaw =
    row.descricao == null ? '' : String(row.descricao).trim()
  const descricao = descricaoRaw.length ? descricaoRaw : null

  const rowWorkspaceId = Number(row.workspace_id)
  const wsId =
    Number.isFinite(rowWorkspaceId) && rowWorkspaceId > 0 ? rowWorkspaceId : workspaceId

  const nomesProdutos = extrairNomesProdutos(row)
  const content = buildTermoContent(nome, descricao, nomesProdutos)
  const lineCount = content.split('\n').length

  const contentHash = createHash('sha256')
    .update(buildContentHashInput(content, wsId))
    .digest('hex')

  const metadata: TermoDocumentMetadata = {
    loc: {
      lines: {
        from: 1,
        to: lineCount,
      },
    },
    source: 'blob',
    blobType: 'text/plain',
    workspace_id: String(wsId),
    content_hash: contentHash,
    termo_id: String(id),
    nome,
    descricao,
  }

  return {
    termoId: id,
    content,
    metadata,
    contentHash,
  }
}

/** Fallback para documentos antigos indexados com `codigo do termo: …` no content. */
export function parseTermoIdFromContent(content: string): string | null {
  const legacy = content.match(/^codigo do termo:\s*([^|]+?)\s*\|/i)
  const legacyValue = legacy?.[1]?.trim()
  if (legacyValue) return legacyValue
  return null
}

export function parseTermoIdFromMetadata(meta: unknown): string | null {
  if (meta == null || typeof meta !== 'object') return null
  const rec = meta as Record<string, unknown>
  const raw = rec.termo_id
  if (raw == null) return null
  const value = String(raw).trim()
  return value || null
}
