import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError, getQuery } from 'h3'
import type { ProdutosOportunidadesVendasTotalResponse } from '#shared/types/produtos'
import { checkWorkspace } from '../../../utils/checkWorkspace'
import { getAuthUserId } from '../../../utils/getAuthUserId'

function parsePositiveInt(raw: unknown, label: string): number {
  const s = String(raw ?? '').trim()
  if (!s) {
    throw createError({ statusCode: 400, statusMessage: `${label} é obrigatório.` })
  }
  const n = Number.parseInt(s, 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw createError({ statusCode: 400, statusMessage: `${label} inválido.` })
  }
  if (String(n) !== s) {
    throw createError({ statusCode: 400, statusMessage: `${label} inválido.` })
  }
  return n
}

/**
 * GET /api/produtos/oportunidades-de-vendas/total?workspace_id=
 *
 * Conta linhas em `view_produtos_nao_encontrados` para o workspace.
 */
export default defineEventHandler(async (event): Promise<ProdutosOportunidadesVendasTotalResponse> => {
  const client = await serverSupabaseClient(event)
  const { data: authData, error: authError } = await client.auth.getUser()

  if (authError || !authData.user) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const userId = getAuthUserId(authData.user)
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const q = getQuery(event)
  const workspaceId = parsePositiveInt(q.workspace_id, 'workspace_id')
  await checkWorkspace(event, workspaceId, userId)

  const admin = serverSupabaseServiceRole<any>(event)
  const { count, error } = await admin
    .from('view_produtos_nao_encontrados')
    .select('produto_chave', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return {
    total: typeof count === 'number' && Number.isFinite(count) ? count : 0,
  }
})
