import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import { getAuthUserId } from '../../../utils/getAuthUserId'
import { checkWorkspace } from '../../../utils/checkWorkspace'

type Body = {
  workspace_id?: unknown
  coluna_id?: unknown
  /** Troca `ordem` com o vizinho à esquerda ou à direita. */
  direcao?: unknown
}

function parseIntPos(raw: unknown): number | null {
  const n =
    typeof raw === 'number' ? raw : Number.parseInt(String(raw ?? ''), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return null
  return n
}

/**
 * POST /api/kanban/coluna/reordenar
 * Body: `{ workspace_id, coluna_id, direcao: 'esquerda' | 'direita' }`
 * Troca `ordem` entre esta coluna e o vizinho imediato no funil.
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

  const workspaceId = parseIntPos(body.workspace_id)
  if (!workspaceId) {
    throw createError({ statusCode: 400, statusMessage: 'workspace_id inválido.' })
  }

  const colunaId = parseIntPos(body.coluna_id)
  if (!colunaId) {
    throw createError({ statusCode: 400, statusMessage: 'coluna_id inválido.' })
  }

  const dirRaw = typeof body.direcao === 'string' ? body.direcao.trim().toLowerCase() : ''
  const direcao: 'esquerda' | 'direita' | null =
    dirRaw === 'esquerda' || dirRaw === 'left' || dirRaw === 'e'
      ? 'esquerda'
      : dirRaw === 'direita' || dirRaw === 'right' || dirRaw === 'd'
        ? 'direita'
        : null
  if (!direcao) {
    throw createError({
      statusCode: 400,
      statusMessage: "Informe direcao: 'esquerda' ou 'direita'.",
    })
  }

  await checkWorkspace(event, workspaceId, userId)

  const admin = serverSupabaseServiceRole<any>(event)

  const { data: coluna, error: colErr } = await admin
    .from('funil_workspace_colunas')
    .select('id, funil_id, ordem')
    .eq('id', colunaId)
    .is('deleted_at', null)
    .maybeSingle()

  if (colErr) throw createError({ statusCode: 500, statusMessage: colErr.message })
  if (!coluna) {
    throw createError({ statusCode: 404, statusMessage: 'Coluna não encontrada.' })
  }

  const funilId =
    typeof coluna.funil_id === 'number' ? coluna.funil_id : Number(coluna.funil_id)
  const ordemA =
    typeof coluna.ordem === 'number' ? coluna.ordem : Number(coluna.ordem)
  if (!Number.isFinite(ordemA)) {
    throw createError({ statusCode: 500, statusMessage: 'Ordem da coluna inválida.' })
  }

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

  const { data: colunasRows, error: listErr } = await admin
    .from('funil_workspace_colunas')
    .select('id, ordem')
    .eq('funil_id', funilId)
    .is('deleted_at', null)
    .order('ordem', { ascending: true })

  if (listErr) throw createError({ statusCode: 500, statusMessage: listErr.message })

  const cols = (colunasRows ?? []) as Array<{ id: number; ordem: number }>
  const idx = cols.findIndex((c) => c.id === colunaId)
  if (idx === -1) {
    throw createError({ statusCode: 404, statusMessage: 'Coluna não está no funil.' })
  }

  const neighborIdx = direcao === 'esquerda' ? idx - 1 : idx + 1
  if (neighborIdx < 0 || neighborIdx >= cols.length) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Não é possível mover nesta direção.',
    })
  }

  const rowA = cols[idx]!
  const rowB = cols[neighborIdx]!
  const oa =
    typeof rowA.ordem === 'number' ? rowA.ordem : Number(rowA.ordem)
  const ob =
    typeof rowB.ordem === 'number' ? rowB.ordem : Number(rowB.ordem)
  if (!Number.isFinite(oa) || !Number.isFinite(ob)) {
    throw createError({ statusCode: 500, statusMessage: 'Ordem inválida nas colunas.' })
  }

  const nowIso = new Date().toISOString()

  const { error: e1 } = await admin
    .from('funil_workspace_colunas')
    .update({ ordem: ob, updated_at: nowIso })
    .eq('id', rowA.id)

  if (e1) throw createError({ statusCode: 500, statusMessage: e1.message })

  const { error: e2 } = await admin
    .from('funil_workspace_colunas')
    .update({ ordem: oa, updated_at: nowIso })
    .eq('id', rowB.id)

  if (e2) throw createError({ statusCode: 500, statusMessage: e2.message })

  return { ok: true as const }
})
