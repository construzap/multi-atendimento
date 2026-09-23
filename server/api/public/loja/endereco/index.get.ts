import { assertMethod, createError, getQuery } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { LojaEnderecosListaResponse } from '#shared/types/loja'
import { parseIdPositivo } from '../../../../utils/lojaLogin'
import {
  carregarConversaLoja,
  ENDERECO_SELECT,
  parseConversaKey,
  parseEnderecoRow,
} from '../../../../utils/lojaEndereco'

/**
 * GET /api/public/loja/endereco?id_canal=&conversa_key=
 */
export default defineEventHandler(async (event): Promise<LojaEnderecosListaResponse> => {
  assertMethod(event, 'GET')

  const q = getQuery(event)
  const idCanal = parseIdPositivo(q.id_canal)
  if (idCanal == null) {
    throw createError({ statusCode: 400, statusMessage: 'id_canal inválido.' })
  }
  const conversaKey = parseConversaKey(q.conversa_key)

  const admin = serverSupabaseServiceRole<any>(event)
  const conversa = await carregarConversaLoja(admin, conversaKey, idCanal)

  const { data, error } = await admin
    .from('enderecos_clientes')
    .select(ENDERECO_SELECT)
    .eq('conversa_key', conversa.key)
    .eq('id_canal', conversa.id_canal)
    .is('deleted_at', null)
    .order('padrao', { ascending: false })
    .order('id', { ascending: false })

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  const lista = (Array.isArray(data) ? data : [])
    .map((row) => parseEnderecoRow(row))
    .filter((row): row is NonNullable<typeof row> => row != null)

  return { ok: true, data: lista }
})
