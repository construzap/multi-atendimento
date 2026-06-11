import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, getRouterParam, readBody } from 'h3'
import type { ProdutosTermoPesquisaAtualizarResponse } from '#shared/types/produtos'
import {
  escapeIlikeLiteral,
  mapTermoPesquisaRow,
  normalizarNomeTermoPesquisa,
} from '../../../utils/produtoTermosPesquisa'
import { checkWorkspace } from '../../../utils/checkWorkspace'
import { getAuthUserId } from '../../../utils/getAuthUserId'

type Body = {
  workspace_id?: unknown
  nome?: unknown
}

function parsePositiveInt(raw: unknown, label: string): number {
  const s = String(raw ?? '').trim()
  if (!s) {
    throw createError({ statusCode: 400, statusMessage: `${label} é obrigatório.` })
  }
  const n = Number.parseInt(s, 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw createError({ statusCode: 400, statusMessage: `${label} inválido.` })
  }
  if (String(n) !== s) {
    throw createError({ statusCode: 400, statusMessage: `${label} inválido.` })
  }
  return n
}

/**
 * PATCH /api/produtos/termos-de-pesquisa/:id
 */
export default defineEventHandler(async (event): Promise<ProdutosTermoPesquisaAtualizarResponse> => {
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

  const idParam = getRouterParam(event, 'id')
  const termoId = Number.parseInt(String(idParam ?? ''), 10)
  if (!Number.isFinite(termoId) || termoId < 1) {
    throw createError({ statusCode: 400, statusMessage: 'id do termo inválido.' })
  }

  const body = (await readBody<Body>(event).catch(() => null)) ?? {}
  const workspaceId = parsePositiveInt(body.workspace_id, 'workspace_id')
  const nomeRaw = typeof body.nome === 'string' ? body.nome : String(body.nome ?? '')
  const nome = normalizarNomeTermoPesquisa(nomeRaw)
  if (!nome) {
    throw createError({ statusCode: 400, statusMessage: 'Informe o nome do termo.' })
  }
  if (nome.length > 200) {
    throw createError({ statusCode: 400, statusMessage: 'Nome do termo demasiado longo (máx. 200 caracteres).' })
  }

  await checkWorkspace(event, workspaceId, userId)

  const admin = serverSupabaseServiceRole<any>(event)

  const { data: atual, error: selErr } = await admin
    .from('produto_termo_de_pesquisa')
    .select('id, nome')
    .eq('id', termoId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (selErr) {
    throw createError({ statusCode: 500, statusMessage: selErr.message })
  }
  if (!atual) {
    throw createError({ statusCode: 404, statusMessage: 'Termo não encontrado neste workspace.' })
  }

  const nomeAtual = String((atual as Record<string, unknown>).nome ?? '').trim().toLocaleUpperCase('pt-BR')
  if (nomeAtual === nome) {
    return { data: mapTermoPesquisaRow(atual as Record<string, unknown>) }
  }

  const literal = escapeIlikeLiteral(nome)
  const { data: outro, error: dupErr } = await admin
    .from('produto_termo_de_pesquisa')
    .select('id')
    .eq('workspace_id', workspaceId)
    .ilike('nome', literal)
    .neq('id', termoId)
    .limit(1)
    .maybeSingle()

  if (dupErr) {
    throw createError({ statusCode: 500, statusMessage: dupErr.message })
  }
  if (outro) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Já existe outro termo com esse nome neste workspace.',
    })
  }

  const { data: updated, error: upErr } = await admin
    .from('produto_termo_de_pesquisa')
    .update({ nome })
    .eq('id', termoId)
    .eq('workspace_id', workspaceId)
    .select('id, nome')
    .single()

  if (upErr) {
    throw createError({ statusCode: 500, statusMessage: upErr.message })
  }

  return { data: mapTermoPesquisaRow(updated as Record<string, unknown>) }
})
