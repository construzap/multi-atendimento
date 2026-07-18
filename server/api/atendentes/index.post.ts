import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import { checkSubscription } from '../../utils/checkSubscription'
import { criarPageRolePadraoPorProfileId } from '../../utils/criarPageRolePadrao'
import { getAuthUserId } from '../../utils/getAuthUserId'

type Body = {
  workspace_id?: unknown
  email?: unknown
}

function parseWorkspaceId(raw: unknown): number | null {
  const n =
    typeof raw === 'number' ? raw : Number.parseInt(String(raw ?? ''), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return null
  return n
}

/** Busca perfil por e-mail (tenta igualdade exata e depois ILIKE escapado). */
async function findProfileByEmail(
  admin: any,
  emailRaw: string,
): Promise<{ user_id: string; profile_id: number } | null> {
  const email = emailRaw.trim()
  if (!email) return null

  const mapRow = (row: { user_id?: unknown; id?: unknown } | null) => {
    if (!row) return null
    const uidRaw = row.user_id
    const userId = typeof uidRaw === 'string' ? uidRaw : uidRaw != null ? String(uidRaw) : ''
    const idRaw = row.id
    const profileId = typeof idRaw === 'number' ? idRaw : Number.parseInt(String(idRaw ?? ''), 10)
    if (!userId || !Number.isFinite(profileId) || profileId < 1) return null
    return { user_id: userId, profile_id: profileId }
  }

  const { data: exact } = await admin
    .from('profiles')
    .select('id, user_id')
    .eq('email', email)
    .maybeSingle()

  const mappedExact = mapRow(exact as { user_id?: unknown; id?: unknown } | null)
  if (mappedExact) return mappedExact

  const escaped = email.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
  const { data: ci } = await admin
    .from('profiles')
    .select('id, user_id')
    .ilike('email', escaped)
    .maybeSingle()

  return mapRow(ci as { user_id?: unknown; id?: unknown } | null)
}

function subscriptionPermiteGestao(statusRaw: string): boolean {
  const s = statusRaw.trim().toLowerCase()
  return (
    s === 'ativo' ||
    s === 'ativa' ||
    s === 'trial' ||
    s === 'vencida' ||
    s === 'vencido'
  )
}

/**
 * POST /api/atendentes
 * Body: `{ workspace_id, email }`
 *
 * Somente o **criador** do workspace (`workspace.user_id`) pode adicionar atendentes.
 * Ordem: autenticação → dono → assinatura → perfil por e-mail → `atendentes` + `page_roles` padrão.
 */
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

  const body = (await readBody<Body>(event).catch(() => null)) ?? {}
  const workspaceId = parseWorkspaceId(body.workspace_id)
  if (!workspaceId) {
    throw createError({ statusCode: 400, statusMessage: 'workspace_id inválido.' })
  }

  const emailStr = typeof body.email === 'string' ? body.email : String(body.email ?? '')
  const email = emailStr.trim()
  if (!email) {
    throw createError({ statusCode: 400, statusMessage: 'Informe o e-mail do atendente.' })
  }

  const admin = serverSupabaseServiceRole<any>(event)

  const { data: wsRow, error: wsErr } = await admin
    .from('workspace')
    .select('id, user_id')
    .eq('id', workspaceId)
    .is('deleted_at', null)
    .is('deleted_by', null)
    .maybeSingle()

  if (wsErr) {
    throw createError({ statusCode: 500, statusMessage: wsErr.message })
  }
  if (!wsRow) {
    throw createError({ statusCode: 404, statusMessage: 'Workspace não encontrado.' })
  }

  const ownerIdRaw = (wsRow as { user_id?: unknown }).user_id
  const ownerId =
    typeof ownerIdRaw === 'string' ? ownerIdRaw : ownerIdRaw != null ? String(ownerIdRaw) : ''

  if (!ownerId || ownerId !== userId) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Apenas o criador do workspace pode adicionar atendentes.',
    })
  }

  const sub = await checkSubscription(event, workspaceId)
  if (!subscriptionPermiteGestao(sub.status_assinatura)) {
    throw createError({
      statusCode: 403,
      statusMessage:
        'Regularize seu plano ou pagamento para adicionar atendentes. Assinaturas pendentes ou canceladas não permitem esta ação.',
    })
  }

  const perfilAtendente = await findProfileByEmail(admin, email)
  if (!perfilAtendente) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Não encontramos um cadastro com este e-mail.',
    })
  }

  const novoAtendenteUserId = perfilAtendente.user_id

  if (novoAtendenteUserId === userId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Você já é atendente deste workspace como criador.',
    })
  }

  const { data: jaExiste } = await admin
    .from('atendentes')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('atendente_user_id', novoAtendenteUserId)
    .maybeSingle()

  if (jaExiste) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Este usuário já é atendente deste workspace.',
    })
  }

  const { error: insErr } = await admin.from('atendentes').insert({
    workspace_id: workspaceId,
    admin_user_id: ownerId,
    atendente_user_id: novoAtendenteUserId,
  })

  if (insErr) {
    if (insErr.code === '23505') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Este usuário já é atendente deste workspace.',
      })
    }
    throw createError({ statusCode: 500, statusMessage: insErr.message })
  }

  await criarPageRolePadraoPorProfileId(event, workspaceId, perfilAtendente.profile_id)

  return { ok: true as const }
})
