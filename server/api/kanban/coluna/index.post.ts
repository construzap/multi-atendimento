import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import { getAuthUserId } from '../../../utils/getAuthUserId'
import { checkWorkspace } from '../../../utils/checkWorkspace'

type Body = {
  workspace_id?: unknown
  funil_id?: unknown
  nome?: unknown
  cor?: unknown
}

const HEX6 = /^#[0-9A-Fa-f]{6}$/

/**
 * POST /api/kanban/coluna
 * Body: `{ workspace_id, funil_id, nome, cor? }`
 * Insere em `funil_workspace_colunas` com `ordem = max(ordem) + 1` (soft-deleted ignorados).
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

  const workspaceIdRaw = body.workspace_id
  const workspaceId =
    typeof workspaceIdRaw === 'number'
      ? workspaceIdRaw
      : Number.parseInt(String(workspaceIdRaw ?? ''), 10)
  if (!Number.isFinite(workspaceId) || !Number.isInteger(workspaceId) || workspaceId < 1) {
    throw createError({ statusCode: 400, statusMessage: 'workspace_id inválido.' })
  }

  const funilIdRaw = body.funil_id
  const funilId =
    typeof funilIdRaw === 'number'
      ? funilIdRaw
      : Number.parseInt(String(funilIdRaw ?? ''), 10)
  if (!Number.isFinite(funilId) || !Number.isInteger(funilId) || funilId < 1) {
    throw createError({ statusCode: 400, statusMessage: 'funil_id inválido.' })
  }

  const nome =
    typeof body.nome === 'string' ? body.nome.trim() : ''
  if (!nome) {
    throw createError({ statusCode: 400, statusMessage: 'Informe o nome da coluna.' })
  }

  let cor: string | null = null
  if (body.cor !== undefined && body.cor !== null && body.cor !== '') {
    const c = typeof body.cor === 'string' ? body.cor.trim() : ''
    if (c && !HEX6.test(c)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Cor deve ser um hex de 6 dígitos (ex.: #38BDF8).',
      })
    }
    cor = c || null
  }

  await checkWorkspace(event, workspaceId, userId)

  const admin = serverSupabaseServiceRole<any>(event)

  const { data: funil, error: funilErr } = await admin
    .from('funil_workspace')
    .select('id, workspace_id')
    .eq('id', funilId)
    .maybeSingle()

  if (funilErr) throw createError({ statusCode: 500, statusMessage: funilErr.message })
  if (!funil) {
    throw createError({ statusCode: 400, statusMessage: 'Funil não encontrado.' })
  }

  const wsFunil =
    typeof funil.workspace_id === 'number'
      ? funil.workspace_id
      : Number(funil.workspace_id)
  if (!Number.isFinite(wsFunil) || wsFunil !== workspaceId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'O funil não pertence a este workspace.',
    })
  }

  const { data: maxRow, error: maxErr } = await admin
    .from('funil_workspace_colunas')
    .select('ordem')
    .eq('funil_id', funilId)
    .is('deleted_at', null)
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (maxErr) throw createError({ statusCode: 500, statusMessage: maxErr.message })

  const maxOrdem =
    maxRow && typeof maxRow.ordem === 'number'
      ? maxRow.ordem
      : maxRow?.ordem != null
        ? Number(maxRow.ordem)
        : NaN
  const nextOrdem = Number.isFinite(maxOrdem) ? maxOrdem + 1 : 1

  const nowIso = new Date().toISOString()

  const { data: inserted, error: insErr } = await admin
    .from('funil_workspace_colunas')
    .insert({
      funil_id: funilId,
      nome,
      cor,
      ordem: nextOrdem,
      updated_at: nowIso,
    })
    .select('id')
    .single()

  if (insErr) {
    throw createError({ statusCode: 500, statusMessage: insErr.message })
  }

  const id =
    inserted && typeof inserted.id === 'number'
      ? inserted.id
      : inserted?.id != null
        ? Number(inserted.id)
        : null

  return { ok: true as const, id }
})
