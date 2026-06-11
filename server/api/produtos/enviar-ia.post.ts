import { serverSupabaseClient } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import { checkWorkspace } from '../../utils/checkWorkspace'
import { getAuthUserId } from '../../utils/getAuthUserId'

const WEBHOOK_ENVIAR_IA =
  'https://nwebhook.construzap.com/webhook/54d8073c-b293-48d3-8b42-6fce9361028b'

type Body = {
  workspace_id?: unknown
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

/** POST /api/produtos/enviar-ia — dispara importação via I.A. (webhook externo). */
export default defineEventHandler(async (event) => {
  assertMethod(event, 'POST')

  const client = await serverSupabaseClient(event)
  const { data: authData, error: authError } = await client.auth.getUser()

  if (authError || !authData.user) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const userId = getAuthUserId(authData.user)
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const body = await readBody<Body>(event)
  const workspaceId = parseWorkspaceId(body?.workspace_id)
  await checkWorkspace(event, workspaceId, userId)

  let res: Response
  try {
    res = await fetch(WEBHOOK_ENVIAR_IA, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace_id: workspaceId }),
    })
  } catch {
    throw createError({
      statusCode: 502,
      statusMessage: 'Não foi possível contactar o serviço de importação por I.A.',
    })
  }

  if (res.status !== 200) {
    throw createError({
      statusCode: 502,
      statusMessage: `O serviço de importação respondeu com status ${res.status}.`,
    })
  }

  return { ok: true as const }
})
