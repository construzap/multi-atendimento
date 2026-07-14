import { serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import type {
  AdminAtualizarLimiteProdutosBody,
  AdminAtualizarLimiteProdutosResponse,
} from '#shared/types/admin'
import {
  assertAdminWorkspaceAtivo,
  parseWorkspaceId,
  requireAdminUser,
} from '../../../utils/adminPrompt'

function parseLimiteProdutos(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') {
    return null
  }

  const n =
    typeof raw === 'number' && Number.isInteger(raw)
      ? raw
      : Number.parseInt(String(raw ?? '').trim(), 10)

  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'limite_produtos deve ser um inteiro maior ou igual a zero, ou null.',
    })
  }

  return n
}

/**
 * PATCH /api/admin/produtos/limite-produtos
 * Body: `{ workspace_id, limite_produtos }`
 * Atualiza `workspace.limite_produtos`.
 */
export default defineEventHandler(
  async (event): Promise<AdminAtualizarLimiteProdutosResponse> => {
    assertMethod(event, 'PATCH')

    await requireAdminUser(event)

    const body = await readBody<AdminAtualizarLimiteProdutosBody>(event)
    const workspaceId = parseWorkspaceId(body?.workspace_id)
    const limiteProdutos = parseLimiteProdutos(body?.limite_produtos)

    await assertAdminWorkspaceAtivo(event, workspaceId)

    const admin = serverSupabaseServiceRole<any>(event)

    const { data, error } = await admin
      .from('workspace')
      .update({ limite_produtos: limiteProdutos })
      .eq('id', workspaceId)
      .is('deleted_at', null)
      .is('deleted_by', null)
      .select('id, limite_produtos')
      .single()

    if (error) {
      throw createError({ statusCode: 500, statusMessage: error.message })
    }

    const id = typeof data.id === 'number' ? data.id : Number(data.id)
    const limiteRaw = data.limite_produtos
    const limite =
      limiteRaw == null
        ? null
        : typeof limiteRaw === 'number'
          ? limiteRaw
          : Number.parseInt(String(limiteRaw), 10)

    return {
      id: Number.isFinite(id) ? id : workspaceId,
      limite_produtos: limite != null && Number.isFinite(limite) ? limite : null,
    }
  },
)
