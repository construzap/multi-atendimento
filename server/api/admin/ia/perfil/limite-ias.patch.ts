import { serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import type { AdminAtualizarLimiteIasBody, AdminPerfilIaLimites } from '#shared/types/adminIa'
import { requireAdminUser } from '../../../../utils/adminPrompt'
import { fetchPerfilIaLimites } from '../../../../utils/checkIA'

function parseUserId(raw: unknown): string {
  const s = String(raw ?? '').trim()
  if (!s || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)) {
    throw createError({ statusCode: 400, statusMessage: 'user_id inválido.' })
  }
  return s
}

function parseLimiteIas(raw: unknown): number {
  const n =
    typeof raw === 'number' && Number.isInteger(raw)
      ? raw
      : Number.parseInt(String(raw ?? '').trim(), 10)

  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'limite_ias deve ser um inteiro maior ou igual a zero.',
    })
  }

  return n
}

/**
 * PATCH /api/admin/ia/perfil/limite-ias
 * Body: `{ user_id, limite_ias }`
 * Atualiza `profiles.limite_ias` do dono do workspace.
 */
export default defineEventHandler(async (event): Promise<AdminPerfilIaLimites> => {
  assertMethod(event, 'PATCH')

  await requireAdminUser(event)

  const body = await readBody<AdminAtualizarLimiteIasBody>(event)
  const userId = parseUserId(body?.user_id)
  const limiteIas = parseLimiteIas(body?.limite_ias)

  const admin = serverSupabaseServiceRole<any>(event)

  const { data: perfilExistente, error: perfilErr } = await admin
    .from('profiles')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (perfilErr) {
    throw createError({ statusCode: 500, statusMessage: perfilErr.message })
  }

  if (!perfilExistente) {
    throw createError({ statusCode: 404, statusMessage: 'Perfil não encontrado.' })
  }

  const { error: updateErr } = await admin
    .from('profiles')
    .update({ limite_ias: limiteIas })
    .eq('user_id', userId)

  if (updateErr) {
    throw createError({ statusCode: 500, statusMessage: updateErr.message })
  }

  return fetchPerfilIaLimites(event, userId)
})
