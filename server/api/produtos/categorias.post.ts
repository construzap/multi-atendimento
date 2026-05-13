import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import type { ProdutoCategoriaItem, ProdutosCategoriaCriarResponse } from '#shared/types/produtos'
import { normalizarTextoCategoriaUnica } from '#shared/utils/normalizarTextoCategoriaUnica'
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

/** Escapa `\`, `%` e `_` para `ilike` corresponder ao texto literal. */
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
 * POST /api/produtos/categorias
 *
 * Body: `{ workspace_id, nome }` — o nome é normalizado para **maiúsculas** (`pt-BR`) antes de gravar.
 * Insere em `produto_categorias` se ainda não existir categoria com o mesmo nome no workspace
 * (comparação sem distinção de maiúsculas). Se já existir com capitalização diferente, atualiza o nome para a forma canónica.
 */
export default defineEventHandler(async (event): Promise<ProdutosCategoriaCriarResponse> => {
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
  const nome = normalizarTextoCategoriaUnica(nomeRaw)
  if (!nome) {
    throw createError({ statusCode: 400, statusMessage: 'Informe o nome da categoria.' })
  }
  if (nome.length > 200) {
    throw createError({ statusCode: 400, statusMessage: 'Nome da categoria demasiado longo (máx. 200 caracteres).' })
  }

  await checkWorkspace(event, workspaceId, userId)

  const admin = serverSupabaseServiceRole<any>(event)

  const literal = escapeIlikeLiteral(nome)
  const { data: existente, error: selErr } = await admin
    .from('produto_categorias')
    .select('id, nome, ativo')
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
    if (!Number.isFinite(id)) {
      throw createError({ statusCode: 500, statusMessage: 'Resposta inválida ao procurar categoria.' })
    }
    const nomeDb = String(rec.nome ?? '').trim()
    const patch: Record<string, unknown> = {}
    if (!Boolean(rec.ativo)) {
      patch.ativo = true
    }
    if (nomeDb.toLocaleUpperCase('pt-BR') !== nome) {
      patch.nome = nome
    }
    if (Object.keys(patch).length > 0) {
      const { error: upErr } = await admin.from('produto_categorias').update(patch).eq('id', id)
      if (upErr) {
        throw createError({ statusCode: 500, statusMessage: upErr.message })
      }
    }
    return {
      data: mapCategoriaRow({ ...rec, nome, ativo: true }),
      ja_existia: true,
    }
  }

  const { data: inserted, error: insErr } = await admin
    .from('produto_categorias')
    .insert({
      workspace_id: workspaceId,
      nome,
      ativo: true,
    })
    .select('id, nome, ativo')
    .single()

  if (insErr) {
    throw createError({ statusCode: 500, statusMessage: insErr.message })
  }

  return {
    data: mapCategoriaRow(inserted as Record<string, unknown>),
    ja_existia: false,
  }
})
