import { createHash } from 'node:crypto'
import type { TermoDocumentMetadata, TermoEmbeddingPayload } from '#shared/types/vectorStore'

function buildContentHashInput(content: string, workspaceId: number): string {
  return [content, `workspace_id:${String(workspaceId)}`].join('\n')
}

export function buildTermoEmbeddingPayload(
  row: Record<string, unknown>,
  workspaceId: number,
): TermoEmbeddingPayload | null {
  const id = Number(row.id)
  if (!Number.isFinite(id)) return null

  const nome = row.nome != null ? String(row.nome).trim() : ''
  if (!nome) return null

  const rowWorkspaceId = Number(row.workspace_id)
  const wsId =
    Number.isFinite(rowWorkspaceId) && rowWorkspaceId > 0 ? rowWorkspaceId : workspaceId

  const content = nome

  const contentHash = createHash('sha256')
    .update(buildContentHashInput(content, wsId))
    .digest('hex')

  const metadata: TermoDocumentMetadata = {
    loc: {
      lines: {
        from: 1,
        to: 1,
      },
    },
    source: 'blob',
    blobType: 'text/plain',
    workspace_id: String(wsId),
    content_hash: contentHash,
    termo_id: String(id),
    nome,
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
