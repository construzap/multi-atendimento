import { assertMethod, createError, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { LojaLoginCriarResponse } from '#shared/types/loja'
import { celularParaGravar } from '#shared/utils/lojaCelular'
import {
  criarConversaLoja,
  carregarCanalLojaPublica,
  parseIdPositivo,
} from '../../../../utils/lojaLogin'

type Body = {
  id_canal?: unknown
  celular?: unknown
  nome?: unknown
  cpf?: unknown
}

/**
 * POST /api/public/loja/login
 * Cria conversa no canal da loja quando o celular não existe.
 */
export default defineEventHandler(async (event): Promise<LojaLoginCriarResponse> => {
  assertMethod(event, 'POST')

  const body = (await readBody(event).catch(() => null)) as Body | null
  const idCanal = parseIdPositivo(body?.id_canal)
  if (idCanal == null) {
    throw createError({ statusCode: 400, statusMessage: 'id_canal inválido.' })
  }

  const nome = String(body?.nome ?? '').trim()
  if (!nome) {
    throw createError({ statusCode: 400, statusMessage: 'Informe o nome.' })
  }
  if (!celularParaGravar(body?.celular)) {
    throw createError({ statusCode: 400, statusMessage: 'Celular inválido.' })
  }

  const admin = serverSupabaseServiceRole<any>(event)
  const canal = await carregarCanalLojaPublica(admin, idCanal)
  const data = await criarConversaLoja(admin, canal, nome, body?.celular, body?.cpf)

  return { ok: true, criado: true, data }
})
