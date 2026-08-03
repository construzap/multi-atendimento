import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, getQuery, getRouterParam } from 'h3'
import { deleteFromB2 } from '../../utils/b2Storage'
import {
  extrairChaveB2AnotacaoDeUrl,
  resolverBucketAnotacoes,
} from '../../utils/blackblaze-anotacoes-conversas'
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

/**
 * DELETE /api/anotacoes_conversas/:id?workspace_id=
 *
 * Remove a anotação do banco e, se houver `media_url` no B2, apaga o arquivo também.
 */
export default defineEventHandler(async (event): Promise<{ ok: true }> => {
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

  const idParam = getRouterParam(event, 'id')
  const anotacaoId = Number.parseInt(String(idParam ?? ''), 10)
  if (!Number.isFinite(anotacaoId) || anotacaoId < 1) {
    throw createError({ statusCode: 400, statusMessage: 'id da anotação inválido.' })
  }

  const q = getQuery(event)
  const workspaceId = parsePositiveInt(q.workspace_id, 'workspace_id')

  await checkWorkspace(event, workspaceId, userId)

  const admin = serverSupabaseServiceRole<any>(event)

  const { data: atual, error: selErr } = await admin
    .from('anotacoes')
    .select('id, media_url')
    .eq('id', anotacaoId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (selErr) {
    throw createError({ statusCode: 500, statusMessage: selErr.message })
  }
  if (!atual) {
    throw createError({ statusCode: 404, statusMessage: 'Anotação não encontrada.' })
  }

  const mediaUrl = typeof atual.media_url === 'string' ? atual.media_url.trim() : ''
  if (mediaUrl) {
    const config = useRuntimeConfig()
    const bucket = resolverBucketAnotacoes(String(config.b2AnotacoesBucketName ?? ''))
    const key = extrairChaveB2AnotacaoDeUrl(mediaUrl, bucket)
    if (key) {
      try {
        await deleteFromB2(key, bucket)
      } catch {
        /* segue removendo do banco mesmo se o B2 falhar */
      }
    }
  }

  const { error: delErr } = await admin
    .from('anotacoes')
    .delete()
    .eq('id', anotacaoId)
    .eq('workspace_id', workspaceId)

  if (delErr) {
    throw createError({ statusCode: 500, statusMessage: delErr.message })
  }

  return { ok: true }
})
