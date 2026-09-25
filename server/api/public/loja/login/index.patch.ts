import { assertMethod, createError, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { LojaLoginCompletarResponse } from '#shared/types/loja'
import { parseConversaKey } from '../../../../utils/lojaEndereco'
import {
  carregarCanalLojaPublica,
  completarDocumentoLogin,
  parseIdPositivo,
} from '../../../../utils/lojaLogin'

type Body = {
  id_canal?: unknown
  conversa_key?: unknown
  cpf?: unknown
  nome?: unknown
}

/**
 * PATCH /api/public/loja/login
 * Completa nome e/ou CPF da conversa encontrada.
 */
export default defineEventHandler(async (event): Promise<LojaLoginCompletarResponse> => {
  assertMethod(event, 'PATCH')

  const body = (await readBody(event).catch(() => null)) as Body | null
  const idCanal = parseIdPositivo(body?.id_canal)
  if (idCanal == null) {
    throw createError({ statusCode: 400, statusMessage: 'id_canal inválido.' })
  }
  const conversaKey = parseConversaKey(body?.conversa_key)

  const admin = serverSupabaseServiceRole<any>(event)
  const canal = await carregarCanalLojaPublica(admin, idCanal)
  const data = await completarDocumentoLogin(admin, {
    conversaKey,
    idCanal: canal.id,
    ...(body?.cpf !== undefined ? { cpf: body.cpf } : {}),
    ...(body?.nome !== undefined ? { nome: body.nome } : {}),
  })

  return { ok: true, data }
})
