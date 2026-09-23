import { assertMethod, createError, getQuery, getRouterParam } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { parseIdPositivo } from '../../../../utils/lojaLogin'
import { carregarConversaLoja, parseConversaKey } from '../../../../utils/lojaEndereco'

/**
 * DELETE /api/public/loja/endereco/:id?id_canal=&conversa_key=
 */
export default defineEventHandler(async (event): Promise<{ ok: true }> => {
  assertMethod(event, 'DELETE')

  const id = parseIdPositivo(getRouterParam(event, 'id'))
  if (id == null) {
    throw createError({ statusCode: 400, statusMessage: 'id inválido.' })
  }

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
    .update({
      deleted_at: new Date().toISOString(),
      padrao: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('conversa_key', conversa.key)
    .eq('id_canal', conversa.id_canal)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  if (!data) {
    throw createError({ statusCode: 404, statusMessage: 'Endereço não encontrado.' })
  }

  return { ok: true }
})
