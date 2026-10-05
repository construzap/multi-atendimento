import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import { checkWorkspace } from '../../utils/checkWorkspace'
import { getAuthUserId } from '../../utils/getAuthUserId'

const TAMANHO_LOTE = 100

type Body = {
  workspace_id?: unknown
  conversa_key?: unknown
  conversa_keys?: unknown
  coluna_id?: unknown
}

function chavesDoBody(body: Body): string[] {
  const lista: string[] = []
  if (Array.isArray(body.conversa_keys)) {
    for (const item of body.conversa_keys) {
      const key = typeof item === 'string' ? item.trim() : ''
      if (key) lista.push(key)
    }
  }
  const unica = typeof body.conversa_key === 'string' ? body.conversa_key.trim() : ''
  if (unica) lista.push(unica)

  const vistas = new Set<string>()
  const unicas: string[] = []
  for (const key of lista) {
    if (vistas.has(key)) continue
    vistas.add(key)
    unicas.push(key)
  }
  return unicas
}

/**
 * POST /api/kanban/mover
 * Body: `{ workspace_id, coluna_id, conversa_key? , conversa_keys? }`
 * Atualiza `conversas.coluna_id` e `conversas.funil_id`.
 * Várias conversas são gravadas de 100 em 100. O último lote leva só o que restar.
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

  const conversaKeys = chavesDoBody(body)
  if (conversaKeys.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Informe conversa_key.' })
  }

  const colunaIdRaw = body.coluna_id
  const colunaId =
    typeof colunaIdRaw === 'number'
      ? colunaIdRaw
      : Number.parseInt(String(colunaIdRaw ?? ''), 10)
  if (!Number.isFinite(colunaId) || !Number.isInteger(colunaId) || colunaId < 1) {
    throw createError({ statusCode: 400, statusMessage: 'coluna_id inválido.' })
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
    throw createError({
      statusCode: 400,
      statusMessage: 'Coluna inválida ou não encontrada.',
    })
  }

  const funilId =
    typeof coluna.funil_id === 'number'
      ? coluna.funil_id
      : Number.parseInt(String(coluna.funil_id ?? '').trim(), 10)
  if (!Number.isFinite(funilId) || funilId < 1) {
    throw createError({ statusCode: 400, statusMessage: 'Funil da coluna inválido.' })
  }

  const { data: funil, error: funilErr } = await admin
    .from('funil_workspace')
    .select('id')
    .eq('id', funilId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (funilErr) throw createError({ statusCode: 500, statusMessage: funilErr.message })
  if (!funil) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Coluna não pertence a um funil deste workspace.',
    })
  }

  const nowIso = new Date().toISOString()
  const atualizados: string[] = []

  for (let i = 0; i < conversaKeys.length; i += TAMANHO_LOTE) {
    const lote = conversaKeys.slice(i, i + TAMANHO_LOTE)

    const { data: updated, error: upErr } = await admin
      .from('conversas')
      .update({
        coluna_id: colunaId,
        funil_id: funilId,
        updated_at: nowIso,
      })
      .in('key', lote)
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .select('key')

    if (upErr) {
      throw createError({ statusCode: 500, statusMessage: upErr.message })
    }

    for (const row of updated ?? []) {
      const key = typeof row.key === 'string' ? row.key.trim() : ''
      if (key) atualizados.push(key)
    }
  }

  const encontradas = new Set(atualizados)
  const naoEncontradas = conversaKeys.filter((key) => !encontradas.has(key))

  if (conversaKeys.length === 1 && atualizados.length === 0) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Conversa não encontrada neste workspace.',
    })
  }

  return {
    ok: true as const,
    atualizados,
    nao_encontradas: naoEncontradas,
  }
})
