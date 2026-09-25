import { createError } from 'h3'
import type { H3Event } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { CanalProvedorPagamentos } from '#shared/types/canal'
import type {
  LojaEndereco,
  LojaFormaPagamento,
  LojaPedidoItemInput,
  LojaPedidoPublico,
} from '#shared/types/loja'
import { NOTIFICACAO_IA_SELECT } from '#shared/utils/notificacaoIaProdutos'
import { parseFormasPagamento } from './lojaCardapio'
import { parseProvedorPagamentos, parseTaxasCartao } from './canalPagamento'
import { carregarCanalLojaPublica, parseIdPositivo } from './lojaLogin'
import { parseEnderecoRow } from './lojaEndereco'
import { loadCanalCredenciaisPagamento } from './pagamentos/loadCredenciais'
import { resolverGatewayPagamento } from './pagamentos/resolver'
import type { PagamentoBillingType, PagamentoCobrancaResultado } from './pagamentos/tipos'

type Admin = ReturnType<typeof serverSupabaseServiceRole<any>>

export type LojaPedidoCanal = {
  id: number
  workspace_id: number
  nome: string | null
  endereco: string | null
  latitude: number | null
  longitude: number | null
  valor_pedido_minimo: number
  provedor: CanalProvedorPagamentos | null
  formasOnline: string[]
  taxasCartao: Record<string, number>
}

const FORMAS_ONLINE: LojaFormaPagamento[] = ['pix', 'credito_online']

/** Validade do PIX na loja. O QR do Asaas dura até 12 meses; cancelamos a cobrança ao expirar. */
export const PIX_VALIDADE_MINUTOS = 30

export function isoExpiracaoPix(criadoEm: string | Date | null | undefined): string {
  const base = criadoEm ? new Date(criadoEm) : new Date()
  const t = Number.isNaN(base.getTime()) ? Date.now() : base.getTime()
  return new Date(t + PIX_VALIDADE_MINUTOS * 60 * 1000).toISOString()
}

export function pixPedidoExpirado(criadoEm: string | Date | null | undefined): boolean {
  const base = criadoEm ? new Date(criadoEm) : null
  if (!base || Number.isNaN(base.getTime())) return false
  return Date.now() >= base.getTime() + PIX_VALIDADE_MINUTOS * 60 * 1000
}

export function aplicarValidadePix(
  cobranca: PagamentoCobrancaResultado,
  criadoEm: string | Date | null | undefined,
  expirado: boolean,
): PagamentoCobrancaResultado {
  if (!cobranca.pix) return cobranca
  const expiraEm = isoExpiracaoPix(criadoEm)
  if (!expirado) {
    return { ...cobranca, pix: { ...cobranca.pix, expiraEm } }
  }
  return {
    ...cobranca,
    status: cobranca.status === 'pago' ? 'pago' : 'expirado',
    pix: { payload: '', qrCodeBase64: null, expiraEm },
  }
}

export function parseFormaOnline(raw: unknown): 'pix' | 'credito_online' {
  const f = String(raw ?? '').trim()
  if (f === 'pix' || f === 'credito_online') return f
  throw createError({
    statusCode: 400,
    statusMessage: 'Forma de pagamento online inválida. Use PIX ou cartão de crédito.',
  })
}

export function parseItensPedido(raw: unknown): LojaPedidoItemInput[] {
  if (!Array.isArray(raw) || !raw.length) {
    throw createError({ statusCode: 400, statusMessage: 'Informe os itens do pedido.' })
  }
  const itens: LojaPedidoItemInput[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const rec = row as Record<string, unknown>
    const nome = String(rec.nome ?? '').trim()
    const quantidade = Number(rec.quantidade)
    const preco = Number(rec.preco_unitario)
    const produtoId = parseIdPositivo(rec.produto_id)
    if (!nome || !Number.isFinite(quantidade) || quantidade < 1 || !Number.isFinite(preco) || preco < 0) {
      throw createError({ statusCode: 400, statusMessage: 'Item do pedido inválido.' })
    }
    itens.push({
      produto_id: produtoId ?? 0,
      nome,
      quantidade: Math.trunc(quantidade),
      preco_unitario: preco,
      observacao: String(rec.observacao ?? '').trim() || undefined,
    })
  }
  if (!itens.length) {
    throw createError({ statusCode: 400, statusMessage: 'Informe os itens do pedido.' })
  }
  return itens
}

export function totalItens(itens: LojaPedidoItemInput[]): number {
  return Math.round(itens.reduce((acc, i) => acc + i.preco_unitario * i.quantidade, 0) * 100) / 100
}

function chaveFormaOnline(forma: 'pix' | 'credito_online'): string {
  return forma === 'pix' ? 'pix' : 'cartao_credito'
}

function linhasEndereco(endereco: LojaEndereco): string[] {
  const ruaNum = [endereco.rua, endereco.numero].filter(Boolean).join(', ')
  const linhas: string[] = []
  if (endereco.apelido) linhas.push(endereco.apelido)
  if (ruaNum) linhas.push(ruaNum)
  if (endereco.complemento) linhas.push(endereco.complemento)
  if (endereco.bairro) linhas.push(endereco.bairro)
  const cidadeUf = [endereco.cidade, endereco.uf].filter(Boolean).join(' - ')
  if (cidadeUf) linhas.push(cidadeUf)
  if (endereco.cep) linhas.push(endereco.cep)
  return linhas
}

export async function carregarCanalPedido(
  admin: Admin,
  idCanal: number,
): Promise<LojaPedidoCanal> {
  const base = await carregarCanalLojaPublica(admin, idCanal)
  const { data, error } = await admin
    .from('canais')
    .select(
      'id, workspace_id, nome, endereco, latitude, longitude, valor_pedido_minimo, provedor_pagamentos, formas_pagamento, taxas_cartao',
    )
    .eq('id', base.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  if (!data) throw createError({ statusCode: 404, statusMessage: 'Loja não encontrada.' })

  const rec = data as Record<string, unknown>
  const formas = parseFormasPagamento(rec.formas_pagamento)
  const valorMin = Number(rec.valor_pedido_minimo)
  return {
    id: base.id,
    workspace_id: base.workspace_id,
    nome: rec.nome != null ? String(rec.nome).trim() : null,
    endereco: rec.endereco != null ? String(rec.endereco).trim() : null,
    latitude: rec.latitude != null && Number.isFinite(Number(rec.latitude)) ? Number(rec.latitude) : null,
    longitude: rec.longitude != null && Number.isFinite(Number(rec.longitude)) ? Number(rec.longitude) : null,
    valor_pedido_minimo: Number.isFinite(valorMin) ? valorMin : 0,
    provedor: parseProvedorPagamentos(rec.provedor_pagamentos),
    formasOnline: formas.online,
    taxasCartao: parseTaxasCartao(rec.taxas_cartao),
  }
}

export async function carregarClientePedido(
  admin: Admin,
  conversaKey: string,
  idCanal: number,
) {
  const { data, error } = await admin
    .from('conversas')
    .select('key, name, phone, documento, id_canal, workspace_id, deleted_at')
    .eq('key', conversaKey)
    .eq('id_canal', idCanal)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  const rec = data as Record<string, unknown> | null
  const key = String(rec?.key ?? '').trim()
  if (!key) {
    throw createError({ statusCode: 404, statusMessage: 'Cliente não encontrado.' })
  }
  return {
    key,
    nome: String(rec?.name ?? '').trim(),
    celular: String(rec?.phone ?? '').trim(),
    cpf: String(rec?.documento ?? '').trim(),
    workspace_id: parseIdPositivo(rec?.workspace_id) ?? 0,
  }
}

export function validarPedidoOnline(
  canal: LojaPedidoCanal,
  forma: 'pix' | 'credito_online',
  total: number,
) {
  if (!FORMAS_ONLINE.includes(forma)) {
    throw createError({ statusCode: 400, statusMessage: 'Esta forma não é pagamento online.' })
  }
  if (!canal.formasOnline.includes(chaveFormaOnline(forma))) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Esta forma de pagamento não está ativa na loja.',
    })
  }
  if (canal.valor_pedido_minimo > 0 && total < canal.valor_pedido_minimo) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Pedido abaixo do valor mínimo da loja.',
    })
  }
}

export async function montarEnderecoPedido(
  admin: Admin,
  params: {
    modo: 'entrega' | 'retirada'
    conversaKey: string
    enderecoId: number | null
    canal: LojaPedidoCanal
  },
): Promise<{ texto: string | null; lat: number | null; lon: number | null }> {
  if (params.modo === 'retirada') {
    return {
      texto: params.canal.endereco || 'Retirada na loja',
      lat: params.canal.latitude,
      lon: params.canal.longitude,
    }
  }
  if (params.enderecoId == null) {
    throw createError({ statusCode: 400, statusMessage: 'Selecione o endereço de entrega.' })
  }
  const { data, error } = await admin
    .from('enderecos_clientes')
    .select(
      'id, conversa_key, rua, numero, complemento, bairro, cidade, uf, cep, ponto_referencia, apelido, latitude, longitude, deleted_at',
    )
    .eq('id', params.enderecoId)
    .eq('conversa_key', params.conversaKey)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  const parsed = parseEnderecoRow(data)
  if (!parsed) {
    throw createError({ statusCode: 404, statusMessage: 'Endereço não encontrado.' })
  }
  return {
    texto: linhasEndereco(parsed).join(' · ') || null,
    lat: parsed.lat ?? null,
    lon: parsed.lon ?? null,
  }
}

export function billingTypeDeForma(forma: 'pix' | 'credito_online'): PagamentoBillingType {
  return forma === 'pix' ? 'pix' : 'cartao_credito'
}

export function dtoPedido(
  id: number,
  forma: 'pix' | 'credito_online',
  cobranca: PagamentoCobrancaResultado,
  pago: boolean,
): LojaPedidoPublico {
  return {
    id,
    status:
      pago || cobranca.status === 'pago'
        ? 'pago'
        : cobranca.status === 'expirado'
          ? 'expirado'
          : 'aguardando',
    forma,
    valor: cobranca.valor,
    pix: forma === 'pix' ? cobranca.pix : null,
    checkoutUrl: forma === 'credito_online' ? cobranca.checkoutUrl : null,
  }
}

export async function criarGatewayDoCanal(event: H3Event, canal: LojaPedidoCanal) {
  if (canal.provedor !== 'asaas' && canal.provedor !== 'pagar.me') {
    return resolverGatewayPagamento(canal.provedor, '')
  }
  const apiKey = await loadCanalCredenciaisPagamento(event, {
    canalId: canal.id,
    workspaceId: canal.workspace_id,
  })
  return resolverGatewayPagamento(canal.provedor, apiKey)
}

export { NOTIFICACAO_IA_SELECT }
