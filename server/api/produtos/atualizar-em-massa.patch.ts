import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import type { ProdutosAtualizarEmMassaResponse } from '#shared/types/produtos'
import { checkWorkspace } from '../../utils/checkWorkspace'
import { getAuthUserId } from '../../utils/getAuthUserId'
import {
  buildProdutoMassUpdateFromPatch,
  parseProdutoMassUpdateIds,
} from '../../utils/produtoMassUpdatePatch'
import { adicionarTermosVinculoEmMassa } from '../../utils/produtoTermosPesquisa'

const MAX_IDS = 100

type Body = {
  workspace_id?: unknown
  ids?: unknown
  patch?: unknown
}

function parsePositiveInt(raw: unknown, label: string): number {
  const n =
    typeof raw === 'number' && Number.isInteger(raw)
      ? raw
      : Number.parseInt(String(raw ?? '').trim(), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw createError({ statusCode: 400, statusMessage: `${label} inválido.` })
  }
  return n
}

/**
 * PATCH /api/produtos/atualizar-em-massa
 * Body: `{ workspace_id, ids, patch }` — aplica o mesmo patch em até 100 produtos.
 */
export default defineEventHandler(async (event): Promise<ProdutosAtualizarEmMassaResponse> => {
  assertMethod(event, 'PATCH')

  const client = await serverSupabaseClient(event)
  const { data: authData, error: authError } = await client.auth.getUser()

  if (authError || !authData.user) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const userId = getAuthUserId(authData.user)
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const body = (await readBody<Body>(event).catch(() => null)) ?? {}
  const workspaceId = parsePositiveInt(body.workspace_id, 'workspace_id')
  const ids = parseProdutoMassUpdateIds(body.ids, MAX_IDS)

  const rawPatch = body.patch
  if (!rawPatch || typeof rawPatch !== 'object' || Array.isArray(rawPatch)) {
    throw createError({ statusCode: 400, statusMessage: 'Envie um objeto `patch` com os campos a alterar.' })
  }

  await checkWorkspace(event, workspaceId, userId)

  const admin = serverSupabaseServiceRole<any>(event)
  const { update, termosIdsPatch } = await buildProdutoMassUpdateFromPatch(
    admin,
    workspaceId,
    rawPatch as Record<string, unknown>,
  )

  const hasCampos = Object.keys(update).length > 0
  const hasTermos = termosIdsPatch !== undefined

  if (!hasCampos && !hasTermos) {
    throw createError({ statusCode: 400, statusMessage: 'Nenhum campo válido para atualizar.' })
  }

  let atualizadosIds: number[] = []

  if (hasCampos || hasTermos) {
    const patchUpdate: Record<string, unknown> = { ...update, updated_at: new Date().toISOString() }

    const { data, error } = await admin
      .from('produtos_workspace')
      .update(patchUpdate)
      .eq('workspace_id', workspaceId)
      .in('id', ids)
      .select('id')

    if (error) {
      throw createError({ statusCode: 500, statusMessage: error.message })
    }

    atualizadosIds = (data ?? [])
      .map((r: { id?: unknown }) => (typeof r.id === 'number' ? r.id : Number(r.id)))
      .filter((n: number) => Number.isFinite(n))
  }

  if (hasTermos && atualizadosIds.length > 0 && (termosIdsPatch?.length ?? 0) > 0) {
    await adicionarTermosVinculoEmMassa(admin, atualizadosIds, termosIdsPatch ?? [])
  }

  return {
    atualizados: atualizadosIds.length,
    ids: atualizadosIds,
  }
})
