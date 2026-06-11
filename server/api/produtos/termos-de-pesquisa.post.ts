import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import type { ProdutosTermoPesquisaCriarResponse } from '#shared/types/produtos'
import {
  escapeIlikeLiteral,
  mapTermoPesquisaRow,
  normalizarNomeTermoPesquisa,
} from '../../utils/produtoTermosPesquisa'
import { checkWorkspace } from '../../utils/checkWorkspace'
import { getAuthUserId } from '../../utils/getAuthUserId'

type Body = {
  workspace_id?: unknown
  nome?: unknown
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

/**
 * POST /api/produtos/termos-de-pesquisa
 */
export default defineEventHandler(async (event): Promise<ProdutosTermoPesquisaCriarResponse> => {
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

  const literal = escapeIlikeLiteral(nome)
  const { data: existente, error: selErr } = await admin
    .from('produto_termo_de_pesquisa')
    .select('id, nome')
    .eq('workspace_id', workspaceId)
    .ilike('nome', literal)
    .limit(1)
    .maybeSingle()

  if (selErr) {
    throw createError({ statusCode: 500, statusMessage: selErr.message })
  }

  if (existente) {
    const rec = existente as Record<string, unknown>
    const id = typeof rec.id === 'number' ? rec.id : Number(rec.id)
    const nomeDb = String(rec.nome ?? '').trim()
    if (nomeDb.toLocaleUpperCase('pt-BR') !== nome) {
      const { error: upErr } = await admin.from('produto_termo_de_pesquisa').update({ nome }).eq('id', id)
      if (upErr) {
        throw createError({ statusCode: 500, statusMessage: upErr.message })
      }
    }
    return {
      data: mapTermoPesquisaRow({ ...rec, nome }),
      ja_existia: true,
    }
  }

  const { data: inserted, error: insErr } = await admin
    .from('produto_termo_de_pesquisa')
    .insert({ workspace_id: workspaceId, nome })
    .select('id, nome')
    .single()

  if (insErr) {
    throw createError({ statusCode: 500, statusMessage: insErr.message })
  }

  return {
    data: mapTermoPesquisaRow(inserted as Record<string, unknown>),
    ja_existia: false,
  }
})
