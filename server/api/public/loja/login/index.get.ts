import { assertMethod, createError, getQuery } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { LojaLoginBuscaResponse } from '#shared/types/loja'
import { celularParaGravar } from '#shared/utils/lojaCelular'
import {
  buscarConversaPorCelular,
  carregarCanalLojaPublica,
  parseIdPositivo,
} from '../../../../utils/lojaLogin'

/**
 * GET /api/public/loja/login?id_canal=&celular=
 * Busca conversa no canal: primeiro com o 9 extra, depois sem.
 */
export default defineEventHandler(async (event): Promise<LojaLoginBuscaResponse> => {
  assertMethod(event, 'GET')

  const q = getQuery(event)
  const idCanal = parseIdPositivo(q.id_canal)
  if (idCanal == null) {
    throw createError({ statusCode: 400, statusMessage: 'id_canal inválido.' })
  }
  if (!celularParaGravar(q.celular)) {
    throw createError({ statusCode: 400, statusMessage: 'Celular inválido.' })
  }

  const admin = serverSupabaseServiceRole<any>(event)
  const canal = await carregarCanalLojaPublica(admin, idCanal)
  const data = await buscarConversaPorCelular(admin, canal.id, q.celular)

  if (!data) return { ok: true, encontrado: false }
  return { ok: true, encontrado: true, data }
})
