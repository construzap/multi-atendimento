import { assertMethod, createError, getQuery, getRouterParam } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { LojaPedidoGetResponse } from '#shared/types/loja'
import { normalizeTotalOrcamento } from '#shared/utils/notificacaoIaProdutos'
import { parseConversaKey } from '../../../../utils/lojaEndereco'
import { parseIdPositivo } from '../../../../utils/lojaLogin'
import {
  carregarCanalPedido,
  carregarClientePedido,
  criarGatewayDoCanal,
  aplicarValidadePix,
  dtoPedido,
  parseFormaOnline,
  pixPedidoExpirado,
} from '../../../../utils/lojaPedido'
import { triggerLojaPedidoPago } from '../../../../utils/pusherServer'

function valorDoTotal(raw: unknown): number {
  const tot = normalizeTotalOrcamento(raw)
  return tot.total_a_vista ?? tot.total_a_prazo ?? 0
}

/**
 * GET /api/public/loja/pedido/:id?id_canal=&conversa_key=
 */
export default defineEventHandler(async (event): Promise<LojaPedidoGetResponse> => {
  assertMethod(event, 'GET')

  const id = parseIdPositivo(getRouterParam(event, 'id'))
  if (id == null) throw createError({ statusCode: 400, statusMessage: 'id inválido.' })

  const q = getQuery(event)
  const idCanal = parseIdPositivo(q.id_canal)
  if (idCanal == null) throw createError({ statusCode: 400, statusMessage: 'id_canal inválido.' })
  const conversaKey = parseConversaKey(q.conversa_key)

  const admin = serverSupabaseServiceRole<any>(event)
  const canal = await carregarCanalPedido(admin, idCanal)
  const cliente = await carregarClientePedido(admin, conversaKey, canal.id)

  const { data, error } = await admin
    .from('notificacoes_ia')
    .select('id, conversa_key, canal_id, forma_pagamento, id_cobranca, pagamento_realizado, total_orcamento, created_at')
    .eq('id', id)
    .eq('conversa_key', cliente.key)
    .eq('canal_id', canal.id)
    .maybeSingle()

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  if (!data) throw createError({ statusCode: 404, statusMessage: 'Pedido não encontrado.' })

  const rec = data as Record<string, unknown>
  const forma = parseFormaOnline(rec.forma_pagamento)
  const pago = rec.pagamento_realizado === true
  const cobrancaId = String(rec.id_cobranca ?? '').trim()
  const valorLocal = valorDoTotal(rec.total_orcamento)

  if (pago) {
    return {
      ok: true,
      data: {
        id,
        status: 'pago',
        forma,
        valor: valorLocal,
        pix: null,
        checkoutUrl: null,
      },
    }
  }

  if (!cobrancaId) {
    throw createError({ statusCode: 409, statusMessage: 'Cobrança ainda não gerada para este pedido.' })
  }

  const gateway = await criarGatewayDoCanal(event, canal)
  const cobranca = await gateway.consultarCobranca(cobrancaId)

  if (cobranca.status === 'pago') {
    await admin
      .from('notificacoes_ia')
      .update({
        pagamento_realizado: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('conversa_key', cliente.key)
    await triggerLojaPedidoPago(event, id)
    return { ok: true, data: dtoPedido(id, forma, cobranca, true) }
  }

  const expirado = forma === 'pix' && pixPedidoExpirado(rec.created_at)
  if (expirado) {
    await gateway.cancelarCobranca(cobrancaId)
  }

  const cobrancaComValidade = aplicarValidadePix(cobranca, rec.created_at, expirado)
  return { ok: true, data: dtoPedido(id, forma, cobrancaComValidade, false) }
})
