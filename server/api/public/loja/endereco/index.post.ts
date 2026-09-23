import { assertMethod, createError, readBody } from 'h3'
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
 * POST /api/public/loja/endereco
 */
export default defineEventHandler(async (event): Promise<LojaEnderecoItemResponse> => {
  assertMethod(event, 'POST')

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
    await desmarcarOutrosPadrao(admin, conversa.key)
  }

  const nowIso = new Date().toISOString()
  const { data, error } = await admin
    .from('enderecos_clientes')
    .insert({
      conversa_key: conversa.key,
      workspace_id: conversa.workspace_id,
      id_canal: conversa.id_canal,
      ...campos,
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select(ENDERECO_SELECT)
    .single()

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  const parsed = parseEnderecoRow(data)
  if (!parsed) throw createError({ statusCode: 500, statusMessage: 'Não foi possível salvar o endereço.' })

  return { ok: true, data: parsed }
})
