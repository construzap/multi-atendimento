import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import type { EntregadorListaItem } from '#shared/types/entregadores'
import { checkWorkspace } from '../../utils/checkWorkspace'
import { getAuthUserId } from '../../utils/getAuthUserId'

type Body = {
  workspace_id?: unknown
  id?: unknown
  codigo?: unknown
  nome?: unknown
  ativo?: unknown
}

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

function normalizeCodigo(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
}

/**
 * PATCH /api/entregadores
 * Body: `{ workspace_id, id, codigo?, nome?, ativo? }`
 */
export default defineEventHandler(async (event): Promise<EntregadorListaItem> => {
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
  const workspaceId = parsePositiveInt(body.workspace_id, 'workspace_id')
  const id = parsePositiveInt(body.id, 'id')

  await checkWorkspace(event, workspaceId, userId)

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (body.codigo !== undefined) {
    const codigo = normalizeCodigo(body.codigo)
    if (!codigo) {
      throw createError({ statusCode: 400, statusMessage: 'Informe o código do entregador.' })
    }
    if (codigo.length > 40) {
      throw createError({ statusCode: 400, statusMessage: 'Código demasiado longo (máx. 40).' })
    }
    patch.codigo = codigo
  }

  if (body.nome !== undefined) {
    const nome = String(body.nome ?? '').trim()
    if (!nome) {
      throw createError({ statusCode: 400, statusMessage: 'Informe o nome do entregador.' })
    }
    if (nome.length > 200) {
      throw createError({ statusCode: 400, statusMessage: 'Nome demasiado longo (máx. 200).' })
    }
    patch.nome = nome
  }

  if (body.ativo !== undefined) {
    patch.ativo = body.ativo === true || body.ativo === 'true' || body.ativo === 1
  }

  if (Object.keys(patch).length <= 1) {
    throw createError({ statusCode: 400, statusMessage: 'Nada para atualizar.' })
  }

  const admin = serverSupabaseServiceRole<any>(event)
  const { data, error } = await admin
    .from('entregadores')
    .update(patch)
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .select('id, codigo, nome, ativo, created_at, updated_at')
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
    throw createError({ statusCode: 404, statusMessage: 'Entregador não encontrado.' })
  }

  const rowId = typeof data.id === 'number' ? data.id : Number(data.id)
  return {
    id: rowId,
    codigo: String(data.codigo ?? ''),
    nome: String(data.nome ?? ''),
    ativo: data.ativo !== false,
    created_at: data.created_at != null ? String(data.created_at) : '',
    updated_at: data.updated_at != null ? String(data.updated_at) : '',
  }
})
