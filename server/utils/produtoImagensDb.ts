import { createError } from 'h3'
import type { ProdutoImagemItem } from '#shared/types/produtos'

export function mapProdutoImagemRow(r: Record<string, unknown>): ProdutoImagemItem {
  const id = typeof r.id === 'number' ? r.id : Number.parseInt(String(r.id ?? ''), 10)
  const produto_id =
    typeof r.produto_id === 'number' ? r.produto_id : Number.parseInt(String(r.produto_id ?? ''), 10)
  const ordem = typeof r.ordem === 'number' ? r.ordem : Number.parseInt(String(r.ordem ?? '0'), 10)
  const imagem_url = r.imagem_url == null ? null : String(r.imagem_url)
  return {
    id: Number.isFinite(id) ? id : undefined,
    produto_id: Number.isFinite(produto_id) ? produto_id : undefined,
    imagem_url,
    url: imagem_url,
    ordem: Number.isFinite(ordem) ? ordem : 0,
    workspace_id: r.workspace_id,
    created_at: r.created_at,
  }
}

export async function assertProdutoNoWorkspace(
  admin: ReturnType<typeof import('#supabase/server').serverSupabaseServiceRole<any>>,
  workspaceId: number,
  produtoId: number,
): Promise<void> {
  const { data, error } = await admin
    .from('produtos_workspace')
    .select('id')
    .eq('id', produtoId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }
  if (!data) {
    throw createError({ statusCode: 404, statusMessage: 'Produto não encontrado neste workspace.' })
  }
}

export function parseWorkspaceId(raw: unknown): number {
  const n =
    typeof raw === 'number' && Number.isInteger(raw)
      ? raw
      : Number.parseInt(String(raw ?? '').trim(), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw createError({ statusCode: 400, statusMessage: 'workspace_id inválido.' })
  }
  return n
}

export function parseProdutoId(raw: unknown): number {
  const n =
    typeof raw === 'number' && Number.isInteger(raw)
      ? raw
      : Number.parseInt(String(raw ?? '').trim(), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw createError({ statusCode: 400, statusMessage: 'produto_id inválido.' })
  }
  return n
}
