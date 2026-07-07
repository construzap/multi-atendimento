import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import { getAuthUserId } from '../../../utils/getAuthUserId'
import { checkWorkspace } from '../../../utils/checkWorkspace'

type Body = {
  workspace_id?: unknown
  coluna_id?: unknown
  nome?: unknown
  cor?: unknown
}

const HEX6 = /^#[0-9A-Fa-f]{6}$/

/**
 * PATCH /api/kanban/coluna
 * Body: `{ workspace_id, coluna_id, nome, cor? }`
 */
export default defineEventHandler(async (event) => {
  assertMethod(event, 'PATCH')

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

  const colunaIdRaw = body.coluna_id
  const colunaId =
    typeof colunaIdRaw === 'number'
      ? colunaIdRaw
      : Number.parseInt(String(colunaIdRaw ?? ''), 10)
  if (!Number.isFinite(colunaId) || !Number.isInteger(colunaId) || colunaId < 1) {
    throw createError({ statusCode: 400, statusMessage: 'coluna_id inválido.' })
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

  const { data: coluna, error: colErr } = await admin
    .from('funil_workspace_colunas')
    .select('id, funil_id')
    .eq('id', colunaId)
    .is('deleted_at', null)
    .maybeSingle()

  if (colErr) throw createError({ statusCode: 500, statusMessage: colErr.message })
  if (!coluna) {
    throw createError({ statusCode: 404, statusMessage: 'Coluna não encontrada.' })
  }

  const funilId =
    typeof coluna.funil_id === 'number' ? coluna.funil_id : Number(coluna.funil_id)

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
      statusCode: 403,
      statusMessage: 'Esta coluna não pertence ao workspace informado.',
    })
  }

  const nowIso = new Date().toISOString()

  const { error: upErr } = await admin
    .from('funil_workspace_colunas')
    .update({
      nome,
      cor,
      updated_at: nowIso,
    })
    .eq('id', colunaId)

  if (upErr) {
    throw createError({ statusCode: 500, statusMessage: upErr.message })
  }

  return { ok: true as const }
})
