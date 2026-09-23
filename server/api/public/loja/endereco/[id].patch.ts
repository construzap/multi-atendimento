import { assertMethod, createError, getRouterParam, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { LojaEnderecoItemResponse } from '#shared/types/loja'
import { parseIdPositivo } from '../../../../utils/lojaLogin'
import {
  camposEnderecoDeBody,
  carregarConversaLoja,
  desmarcarOutrosPadrao,
  ENDERECO_SELECT,
  parseConversaKey,
  parseEnderecoRow,
} from '../../../../utils/lojaEndereco'

type Body = Record<string, unknown>

/**
 * PATCH /api/public/loja/endereco/:id
 */
export default defineEventHandler(async (event): Promise<LojaEnderecoItemResponse> => {
  assertMethod(event, 'PATCH')

  const id = parseIdPositivo(getRouterParam(event, 'id'))
  if (id == null) {
    throw createError({ statusCode: 400, statusMessage: 'id inválido.' })
  }

  const body = (await readBody(event).catch(() => null)) as Body | null
  if (!body) {
    throw createError({ statusCode: 400, statusMessage: 'Dados inválidos.' })
  }

  const idCanal = parseIdPositivo(body.id_canal)
  if (idCanal == null) {
    throw createError({ statusCode: 400, statusMessage: 'id_canal inválido.' })
  }
  const conversaKey = parseConversaKey(body.conversa_key)
  const campos = camposEnderecoDeBody(body)

  const admin = serverSupabaseServiceRole<any>(event)
  const conversa = await carregarConversaLoja(admin, conversaKey, idCanal)

  if (campos.padrao) {
    await desmarcarOutrosPadrao(admin, conversa.key, id)
  }

  const { data, error } = await admin
    .from('enderecos_clientes')
    .update({
      ...campos,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('conversa_key', conversa.key)
    .eq('id_canal', conversa.id_canal)
    .is('deleted_at', null)
    .select(ENDERECO_SELECT)
    .maybeSingle()

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  const parsed = parseEnderecoRow(data)
  if (!parsed) {
    throw createError({ statusCode: 404, statusMessage: 'Endereço não encontrado.' })
  }

  return { ok: true, data: parsed }
})
