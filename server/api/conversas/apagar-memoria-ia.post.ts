import { serverSupabaseClient } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import { assertAdminWorkspaceAtivo } from '../../utils/adminPrompt'
import { isUserAdmin } from '../../utils/checkAdmin'
import { checkWorkspace } from '../../utils/checkWorkspace'
import { getAuthUserId } from '../../utils/getAuthUserId'

const WEBHOOK_APAGAR_MEMORIA_IA =
  'https://nwebhook.construzap.com/webhook/apagamemoriaiamultiatendimengoconstruzap33'

type Body = {
  workspace_id?: unknown
  key?: unknown
  phone?: unknown
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

function parseConversaKey(raw: unknown): string {
  const key = String(raw ?? '').trim()
  if (!key) {
    throw createError({ statusCode: 400, statusMessage: 'Informe key da conversa.' })
  }
  return key
}

function parsePhoneOpcional(raw: unknown): string | null {
  const phone = String(raw ?? '').trim()
  return phone || null
}

/** POST /api/conversas/apagar-memoria-ia — dispara webhook para limpar memória da I.A. do contato. */
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
  const key = parseConversaKey(body?.key)
  const phone = parsePhoneOpcional(body?.phone)

  const admin = await isUserAdmin(event, userId)
  if (admin) {
    await assertAdminWorkspaceAtivo(event, workspaceId)
  } else {
    await checkWorkspace(event, workspaceId, userId)
  }

  const payload: Record<string, unknown> = {
    workspace_id: workspaceId,
    key,
  }
  if (phone) payload.phone = phone

  let res: Response
  try {
    res = await fetch(WEBHOOK_APAGAR_MEMORIA_IA, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    throw createError({
      statusCode: 502,
      statusMessage: 'Não foi possível contactar o serviço de memória da I.A.',
    })
  }

  if (!res.ok) {
    throw createError({
      statusCode: 502,
      statusMessage: 'O serviço de memória da I.A. retornou erro.',
    })
  }

  return { ok: true as const }
})
