import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import type { ProdutosEscolhaPlanilhaResponse } from '#shared/types/produtos'
import { checkWorkspace } from '../../../utils/checkWorkspace'
import { getAuthUserId } from '../../../utils/getAuthUserId'
import { aplicarEscolhaPlanilha } from '../../../utils/produtoPlanilhaAtualizar'

type Body = {
  workspace_id?: unknown
  produto_id?: unknown
  candidato_id?: unknown
}

function parseId(raw: unknown, nome: string): number {
  const n =
    typeof raw === 'number' && Number.isInteger(raw)
      ? raw
      : Number.parseInt(String(raw ?? '').trim(), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw createError({ statusCode: 400, statusMessage: `${nome} inválido.` })
  }
  return n
}

/** POST /api/produtos/planilha/escolha-planilha — grava a linha da planilha no candidato escolhido. */
export default defineEventHandler(async (event): Promise<ProdutosEscolhaPlanilhaResponse> => {
  assertMethod(event, 'POST')

  const client = await serverSupabaseClient(event)
  const { data: authData, error: authError } = await client.auth.getUser()
  if (authError || !authData.user) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }
  const userId = getAuthUserId(authData.user)
  if (!userId) throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })

  const body = (await readBody<Body>(event).catch(() => null)) ?? {}
  const workspaceId = parseId(body.workspace_id, 'workspace_id')
  const produtoId = parseId(body.produto_id, 'produto_id')
  const candidatoId = parseId(body.candidato_id, 'candidato_id')

  await checkWorkspace(event, workspaceId, userId)
  const admin = serverSupabaseServiceRole<any>(event)
  const resultado = await aplicarEscolhaPlanilha(admin, workspaceId, produtoId, candidatoId)
  return { ok: true, ainda_pendente: resultado.ainda_pendente }
})
