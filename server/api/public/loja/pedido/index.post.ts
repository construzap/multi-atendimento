import { assertMethod, createError, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { LojaPedidoCreateResponse } from '#shared/types/loja'
import { NOTIFICACAO_IA_SELECT } from '#shared/utils/notificacaoIaProdutos'
import { parseConversaKey } from '../../../../utils/lojaEndereco'
import { parseIdPositivo } from '../../../../utils/lojaLogin'
import {
  billingTypeDeForma,
  carregarCanalPedido,
  carregarClientePedido,
  aplicarValidadePix,
  criarGatewayDoCanal,
  dtoPedido,
  montarEnderecoPedido,
  parseFormaOnline,
  parseItensPedido,
  totalItens,
  validarPedidoOnline,
} from '../../../../utils/lojaPedido'

type Body = Record<string, unknown>

/**
 * POST /api/public/loja/pedido
 * Cria pedido (notificacoes_ia) + cobrança no gateway do canal.
 */
export default defineEventHandler(async (event): Promise<LojaPedidoCreateResponse> => {
  assertMethod(event, 'POST')

  const body = (await readBody(event).catch(() => null)) as Body | null
  if (!body) throw createError({ statusCode: 400, statusMessage: 'Dados inválidos.' })

  const idCanal = parseIdPositivo(body.id_canal)
  if (idCanal == null) throw createError({ statusCode: 400, statusMessage: 'id_canal inválido.' })
  const conversaKey = parseConversaKey(body.conversa_key)
  const forma = parseFormaOnline(body.forma_pagamento)
  const modo = body.modo_recebimento === 'retirada' ? 'retirada' : 'entrega'
  const itens = parseItensPedido(body.itens)
  const total = totalItens(itens)
  const observacoes = String(body.observacoes ?? '').trim() || null
  const parcelasRaw = Number(body.parcelas)
  const parcelas = Number.isFinite(parcelasRaw) && parcelasRaw >= 1 ? Math.trunc(parcelasRaw) : 1
  const enderecoId = parseIdPositivo(body.endereco_id)

  const admin = serverSupabaseServiceRole<any>(event)
  const canal = await carregarCanalPedido(admin, idCanal)
  const cliente = await carregarClientePedido(admin, conversaKey, canal.id)
  validarPedidoOnline(canal, forma, total)
  const gateway = await criarGatewayDoCanal(event, canal)

  const destino = await montarEnderecoPedido(admin, {
    modo,
    conversaKey: cliente.key,
    enderecoId,
    canal,
  })

  const nowIso = new Date().toISOString()
  const produtos = itens.map((i) => ({
    quantidade: i.quantidade,
    nome_produto: i.nome,
    preco_vista: i.preco_unitario,
    preco_prazo: i.preco_unitario,
    subtotal_vista: Math.round(i.preco_unitario * i.quantidade * 100) / 100,
    subtotal_prazo: Math.round(i.preco_unitario * i.quantidade * 100) / 100,
  }))

  const { data: created, error: insErr } = await admin
    .from('notificacoes_ia')
    .insert({
      workspace_id: canal.workspace_id,
      canal_id: canal.id,
      conversa_key: cliente.key,
      fone: cliente.celular || null,
      nome: cliente.nome || null,
      produtos,
      total_orcamento: { total_a_vista: total, total_a_prazo: total },
      forma_pagamento: forma,
      observacoes,
      entrega_ou_retirada: modo,
      endereco: destino.texto,
      latitude: destino.lat,
      longitude: destino.lon,
      tipo_solicitacao: 'pedido_pronto',
      pagamento_realizado: false,
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select(NOTIFICACAO_IA_SELECT)
    .single()

  if (insErr) throw createError({ statusCode: 500, statusMessage: insErr.message })
  const pedidoId = parseIdPositivo((created as { id?: unknown })?.id)
  if (pedidoId == null) {
    throw createError({ statusCode: 500, statusMessage: 'Não foi possível criar o pedido.' })
  }

  const lojaNome = canal.nome || 'Loja'
  const cobranca = await gateway.criarCobranca({
    valor: total,
    descricao: `Pedido #${pedidoId} · ${lojaNome}`,
    referenciaExterna: String(pedidoId),
    cliente: {
      nome: cliente.nome || 'Cliente',
      cpf: cliente.cpf,
      celular: cliente.celular,
    },
    billingType: billingTypeDeForma(forma),
    parcelas,
    taxasCartao: canal.taxasCartao,
  })

  const { error: updErr } = await admin
    .from('notificacoes_ia')
    .update({
      id_cobranca: cobranca.cobrancaId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', pedidoId)
    .eq('conversa_key', cliente.key)

  if (updErr) throw createError({ statusCode: 500, statusMessage: updErr.message })

  const cobrancaComValidade = aplicarValidadePix(cobranca, nowIso, false)

  return {
    ok: true,
    data: dtoPedido(pedidoId, forma, cobrancaComValidade, cobrancaComValidade.status === 'pago'),
  }
})
