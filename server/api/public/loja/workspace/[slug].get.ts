import { assertMethod, createError, getQuery, getRouterParam, setResponseHeader } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { LojaWorkspacePublicoResponse } from '#shared/types/loja'
import {
  isLojaCardapioRpcAusente,
  LOJA_CARDAPIO_CACHE_CONTROL,
  parseLojaCardapioRpc,
  parseLojaCanalRow,
  parseLojaOffset,
  parseLojaSlug,
} from '../../../../utils/lojaCardapio'

const CANAL_LOJA_SELECT =
  'id, workspace_id, longitude, latitude, horarios, tempo_aviso_minutos, endereco, loja_aberta, agenda_pedido, valor_pedido_minimo'

/**
 * GET /api/public/loja/workspace/:slug?offset=
 * 1) Resolve o canal por `canais.loja_slug`.
 * 2) RPC `loja_cardapio` com o `workspace_id`.
 * Cache curto; 404 não é cacheado.
 */
export default defineEventHandler(async (event): Promise<LojaWorkspacePublicoResponse> => {
  assertMethod(event, 'GET')

  const slug = parseLojaSlug(getRouterParam(event, 'slug'))
  const offset = parseLojaOffset(getQuery(event).offset)
  const admin = serverSupabaseServiceRole<any>(event)

  const { data: canalRow, error: canalErro } = await admin
    .from('canais')
    .select(CANAL_LOJA_SELECT)
    .eq('loja_slug', slug)
    .is('deleted_at', null)
    .maybeSingle()

  if (canalErro) {
    throw createError({ statusCode: 500, statusMessage: canalErro.message })
  }

  const canal = parseLojaCanalRow(canalRow)
  if (!canal) {
    throw createError({ statusCode: 404, statusMessage: 'Loja não encontrada.' })
  }

  const { data, error } = await admin.rpc('loja_cardapio', {
    p_workspace_id: canal.workspace_id,
    p_offset: offset,
  })

  if (error) {
    if (isLojaCardapioRpcAusente(error)) {
      throw createError({
        statusCode: 503,
        statusMessage:
          'Função loja_cardapio não encontrada. Rode server/sql/loja_cardapio.sql no Supabase.',
      })
    }
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const parsed = parseLojaCardapioRpc(data, offset, canal)
  if (!parsed) {
    throw createError({ statusCode: 404, statusMessage: 'Loja não encontrada.' })
  }

  setResponseHeader(event, 'Cache-Control', LOJA_CARDAPIO_CACHE_CONTROL)

  return { ok: true, data: parsed }
})
