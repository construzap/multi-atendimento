import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import type { EntregadorListaItem } from '#shared/types/entregadores'
import { checkWorkspace } from '../../utils/checkWorkspace'
import { getAuthUserId } from '../../utils/getAuthUserId'

type Body = {
  workspace_id?: unknown
  codigo?: unknown
  nome?: unknown
  ativo?: unknown
  entregador_premium?: unknown
}

function parseWorkspaceId(raw: unknown): number {
  const n =
    typeof raw === 'number' ? raw : Number.parseInt(String(raw ?? '').trim(), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw createError({ statusCode: 400, statusMessage: 'workspace_id inválido.' })
  }
  return n
}

function normalizeCodigo(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
}

/**
 * POST /api/entregadores
 * Body: `{ workspace_id, codigo, nome, ativo?, entregador_premium? }`
 */
export default defineEventHandler(async (event): Promise<EntregadorListaItem> => {
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
  const codigo = normalizeCodigo(body.codigo)
  const nome = String(body.nome ?? '').trim()
  const ativo = body.ativo === false ? false : true
  const entregadorPremium = body.entregador_premium === true

  if (!codigo) {
    throw createError({ statusCode: 400, statusMessage: 'Informe o código do entregador.' })
  }
  if (codigo.length > 40) {
    throw createError({ statusCode: 400, statusMessage: 'Código demasiado longo (máx. 40).' })
  }
  if (!nome) {
    throw createError({ statusCode: 400, statusMessage: 'Informe o nome do entregador.' })
  }
  if (nome.length > 200) {
    throw createError({ statusCode: 400, statusMessage: 'Nome demasiado longo (máx. 200).' })
  }

  await checkWorkspace(event, workspaceId, userId)

  const nowIso = new Date().toISOString()
  const admin = serverSupabaseServiceRole<any>(event)
  const { data, error } = await admin
    .from('entregadores')
    .insert({
      workspace_id: workspaceId,
      codigo,
      nome,
      ativo,
      entregador_premium: entregadorPremium,
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select('id, codigo, nome, ativo, entregador_premium, created_at, updated_at')
    .maybeSingle()

  if (error) {
    if (error.code === '23505') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Já existe um entregador com este código neste workspace.',
      })
    }
    throw createError({ statusCode: 500, statusMessage: error.message })
  }
  if (!data) {
    throw createError({ statusCode: 500, statusMessage: 'Não foi possível criar o entregador.' })
  }

  const id = typeof data.id === 'number' ? data.id : Number(data.id)
  return {
    id,
    codigo: String(data.codigo ?? ''),
    nome: String(data.nome ?? ''),
    ativo: data.ativo !== false,
    entregador_premium: data.entregador_premium === true,
    created_at: data.created_at != null ? String(data.created_at) : nowIso,
    updated_at: data.updated_at != null ? String(data.updated_at) : nowIso,
  }
})
