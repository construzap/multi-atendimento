import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError, getQuery } from 'h3'
import type { ValoresCamposPersonalizadosListaResponse } from '#shared/types/camposPersonalizados'
import { mapValorRow } from '../../utils/camposPersonalizadosDb'
import { checkWorkspace } from '../../utils/checkWorkspace'
import { getAuthUserId } from '../../utils/getAuthUserId'
import { parsePositiveInt } from '../../utils/parsePositiveInt'

/**
 * GET /api/valores-campos-personalizados?workspace_id=&conversa_key=
 *
 * Lista valores de `public.valores_campos_personalizados` para a conversa
 * (filtro por `conversa_key`, índice `idx_valores_campos_conversa`).
 * Faz join com `campos_personalizados` para garantir escopo do workspace.
 *
 * No cliente, usar `camposPersonalizadosStore.fetchValores()` — a store consulta
 * `valoresRecentes` antes e só chama esta rota se a conversa não estiver em cache.
 */
export default defineEventHandler(async (event): Promise<ValoresCamposPersonalizadosListaResponse> => {
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
  const conversaKey = String(q.conversa_key ?? '').trim()

  if (!conversaKey) {
    throw createError({ statusCode: 400, statusMessage: 'Informe conversa_key na query.' })
  }

  await checkWorkspace(event, workspaceId, userId)

  const admin = serverSupabaseServiceRole<any>(event)

  const { data: conversa, error: convErr } = await admin
    .from('conversas')
    .select('key')
    .eq('key', conversaKey)
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .maybeSingle()

  if (convErr) {
    throw createError({ statusCode: 500, statusMessage: convErr.message })
  }
  if (!conversa) {
    throw createError({ statusCode: 404, statusMessage: 'Conversa não encontrada neste workspace.' })
  }

  const { data, error } = await admin
    .from('valores_campos_personalizados')
    .select(
      `
      id,
      campo_id,
      conversa_key,
      valor,
      updated_at,
      campos_personalizados!inner (
        workspace_id
      )
    `,
    )
    .eq('conversa_key', conversaKey)
    .eq('campos_personalizados.workspace_id', workspaceId)
    .order('campo_id', { ascending: true })

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return {
    data: (data ?? []).map((r: Record<string, unknown>) => mapValorRow(r)),
  }
})
