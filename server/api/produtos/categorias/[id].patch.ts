import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, getRouterParam, readBody } from 'h3'
import type { ProdutoCategoriaItem, ProdutosCategoriaAtualizarResponse } from '#shared/types/produtos'
import { normalizarTextoCategoriaUnica } from '#shared/utils/normalizarTextoCategoriaUnica'
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

/** Escapa `%` e `_` para `ilike` corresponder ao texto literal. */
function escapeIlikeLiteral(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

function mapCategoriaRow(r: Record<string, unknown>): ProdutoCategoriaItem {
  const id = typeof r.id === 'number' ? r.id : Number(r.id)
  const nomeRaw = String(r.nome ?? '').trim()
  return {
    id: Number.isFinite(id) ? id : 0,
    nome: nomeRaw.length ? nomeRaw.toLocaleUpperCase('pt-BR') : '',
    ativo: Boolean(r.ativo),
  }
}

/**
 * PATCH /api/produtos/categorias/:id
 *
 * Body: `{ workspace_id, nome }` — renomeia a categoria (nome canónico em maiúsculas).
 */
export default defineEventHandler(async (event): Promise<ProdutosCategoriaAtualizarResponse> => {
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
  const categoriaId = Number.parseInt(String(idParam ?? ''), 10)
  if (!Number.isFinite(categoriaId) || categoriaId < 1) {
    throw createError({ statusCode: 400, statusMessage: 'id da categoria inválido.' })
  }

  const body = (await readBody<Body>(event).catch(() => null)) ?? {}
  const workspaceId = parsePositiveInt(body.workspace_id, 'workspace_id')
  const nomeRaw = typeof body.nome === 'string' ? body.nome : String(body.nome ?? '')
  const nome = normalizarTextoCategoriaUnica(nomeRaw)
  if (!nome) {
    throw createError({ statusCode: 400, statusMessage: 'Informe o nome da categoria.' })
  }
  if (nome.length > 200) {
    throw createError({ statusCode: 400, statusMessage: 'Nome da categoria demasiado longo (máx. 200 caracteres).' })
  }

  await checkWorkspace(event, workspaceId, userId)

  const admin = serverSupabaseServiceRole<any>(event)

  const { data: atual, error: selErr } = await admin
    .from('produto_categorias')
    .select('id, nome, ativo')
    .eq('id', categoriaId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (selErr) {
    throw createError({ statusCode: 500, statusMessage: selErr.message })
  }
  if (!atual) {
    throw createError({ statusCode: 404, statusMessage: 'Categoria não encontrada neste workspace.' })
  }

  const nomeAtual = String((atual as Record<string, unknown>).nome ?? '').trim().toLocaleUpperCase('pt-BR')
  if (nomeAtual === nome) {
    return { data: mapCategoriaRow(atual as Record<string, unknown>) }
  }

  const literal = escapeIlikeLiteral(nome)
  const { data: outro, error: dupErr } = await admin
    .from('produto_categorias')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('ativo', true)
    .ilike('nome', literal)
    .neq('id', categoriaId)
    .limit(1)
    .maybeSingle()

  if (dupErr) {
    throw createError({ statusCode: 500, statusMessage: dupErr.message })
  }
  if (outro) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Já existe outra categoria com esse nome neste workspace.',
    })
  }

  const { data: updated, error: upErr } = await admin
    .from('produto_categorias')
    .update({ nome })
    .eq('id', categoriaId)
    .eq('workspace_id', workspaceId)
    .select('id, nome, ativo')
    .single()

  if (upErr) {
    throw createError({ statusCode: 500, statusMessage: upErr.message })
  }

  return { data: mapCategoriaRow(updated as Record<string, unknown>) }
})
