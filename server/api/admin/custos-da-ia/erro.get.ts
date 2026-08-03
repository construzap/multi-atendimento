import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError } from 'h3'
import type { AdminCustosIaErroResponse, CustoTokenIaErroRow } from '#shared/types/adminCustosIa'
import { checkAdmin } from '../../../utils/checkAdmin'
import { getAuthUserId } from '../../../utils/getAuthUserId'

function mapErroRow(r: Record<string, unknown>): CustoTokenIaErroRow | null {
  const workspaceId = String(r.workspace_id ?? '').trim()
  if (!workspaceId) return null

  const canalRaw = r.canal_id
  const canalId =
    canalRaw == null || String(canalRaw).trim() === '' ? null : String(canalRaw).trim()

  const urlRaw = r.url_erro
  const urlErro =
    urlRaw == null || String(urlRaw).trim() === '' ? null : String(urlRaw).trim()

  return {
    workspace_id: workspaceId,
    canal_id: canalId,
    url_erro: urlErro,
  }
}

/**
 * GET /api/admin/custos-da-ia/erro
 * Lista registros de `custos_tokens_ia` com `erro = true`.
 */
export default defineEventHandler(async (event): Promise<AdminCustosIaErroResponse> => {
  assertMethod(event, 'GET')

  const client = await serverSupabaseClient(event)
  const { data: authData, error: authError } = await client.auth.getUser()

  if (authError || !authData.user) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const userId = getAuthUserId(authData.user)
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  await checkAdmin(event, userId)

  const admin = serverSupabaseServiceRole<any>(event)

  const { data, error } = await admin
    .from('custos_tokens_ia')
    .select('workspace_id, canal_id, url_erro')
    .eq('erro', true)
    .order('criado_em', { ascending: false })

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const items = (data ?? [])
    .map((row) => mapErroRow(row as Record<string, unknown>))
    .filter((row): row is CustoTokenIaErroRow => row != null)

  return { items }
})
