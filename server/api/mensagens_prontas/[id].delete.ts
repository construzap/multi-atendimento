import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, getQuery, getRouterParam } from 'h3'
import type { ExcluirMensagemProntaResponse } from '#shared/types/mensagensProntas'
import { checkWorkspace } from '../../utils/checkWorkspace'
import { getAuthUserId } from '../../utils/getAuthUserId'

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

function parseUuid(raw: string | undefined, label: string): string {
  const s = String(raw ?? '').trim()
  if (!s || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) {
    throw createError({ statusCode: 400, statusMessage: `${label} inválido.` })
  }
  return s
}

/**
 * DELETE /api/mensagens_prontas/:id?workspace_id=
 * Remove a sequência (passos caem em cascade).
 * `coluna_destino_id` não exige limpeza: a FK é da sequência → coluna (ON DELETE SET NULL).
 */
export default defineEventHandler(async (event): Promise<ExcluirMensagemProntaResponse> => {
  assertMethod(event, 'DELETE')

  const client = await serverSupabaseClient(event)
  const { data: authData, error: authError } = await client.auth.getUser()
  if (authError || !authData.user) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const userId = getAuthUserId(authData.user)
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const sequenciaId = parseUuid(getRouterParam(event, 'id'), 'id')
  const q = getQuery(event)
  const workspaceId = parsePositiveInt(q.workspace_id, 'workspace_id')

  await checkWorkspace(event, workspaceId, userId)

  const admin = serverSupabaseServiceRole<any>(event)

  const { data: existente, error: findErr } = await admin
    .from('mensagens_prontas_sequencias')
    .select('id')
    .eq('id', sequenciaId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (findErr) {
    throw createError({ statusCode: 500, statusMessage: findErr.message })
  }
  if (!existente?.id) {
    throw createError({ statusCode: 404, statusMessage: 'Mensagem pronta não encontrada.' })
  }

  const { error: delErr } = await admin
    .from('mensagens_prontas_sequencias')
    .delete()
    .eq('id', sequenciaId)
    .eq('workspace_id', workspaceId)

  if (delErr) {
    throw createError({ statusCode: 500, statusMessage: delErr.message })
  }

  return { ok: true as const, id: sequenciaId }
})
