import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import type { ProdutoAtualizarPlanilhaLinha, ProdutosAtualizarPlanilhaResponse } from '#shared/types/produtos'
import { checkLimiteProdutos } from '../../../utils/checkLimiteProdutos'
import { checkWorkspace } from '../../../utils/checkWorkspace'
import { getAuthUserId } from '../../../utils/getAuthUserId'
import { processarLotePlanilha } from '../../../utils/produtoPlanilhaAtualizar'

const MAX_LINHAS_POR_REQUISICAO = 100

type Body = {
  workspace_id?: unknown
  linhas?: unknown
}

function parseWorkspaceId(raw: unknown): number {
  const n =
    typeof raw === 'number' && Number.isInteger(raw)
      ? raw
      : Number.parseInt(String(raw ?? '').trim(), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw createError({ statusCode: 400, statusMessage: 'workspace_id inválido.' })
  }
  return n
}

/**
 * POST /api/produtos/planilha/atualizar-por-planilha
 *
 * Acha o produto pelo código de barras em `tabelageral` (sem filtrar workspace).
 * Se a barra não existir, usa `codigo` nos produtos do workspace.
 * Um achado atualiza só os campos enviados. Vários achados gravam um produto
 * com `aguardando_escolha`. Nenhum achado grava com `nao_encontrado`.
 */
export default defineEventHandler(async (event): Promise<ProdutosAtualizarPlanilhaResponse> => {
  assertMethod(event, 'POST')

  const client = await serverSupabaseClient(event)
  const { data: authData, error: authError } = await client.auth.getUser()
  if (authError || !authData.user) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }
  const userId = getAuthUserId(authData.user)
  if (!userId) throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })

  const body = (await readBody<Body>(event).catch(() => null)) ?? {}
  const workspaceId = parseWorkspaceId(body.workspace_id)
  if (!Array.isArray(body.linhas)) {
    throw createError({ statusCode: 400, statusMessage: 'linhas deve ser um array.' })
  }
  if (body.linhas.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Envie pelo menos uma linha.' })
  }
  if (body.linhas.length > MAX_LINHAS_POR_REQUISICAO) {
    throw createError({
      statusCode: 400,
      statusMessage: `No máximo ${MAX_LINHAS_POR_REQUISICAO} linhas por requisição.`,
    })
  }

  await checkWorkspace(event, workspaceId, userId)
  const admin = serverSupabaseServiceRole<any>(event)
  const linhas = body.linhas.filter((item) => item && typeof item === 'object') as ProdutoAtualizarPlanilhaLinha[]

  return processarLotePlanilha(admin, workspaceId, linhas, async (quantidade) => {
    await checkLimiteProdutos(event, workspaceId, quantidade)
  })
})
