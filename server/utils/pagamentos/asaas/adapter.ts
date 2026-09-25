import type {
  PagamentoCobrancaInput,
  PagamentoCobrancaResultado,
  PagamentoCobrancaStatus,
  PagamentoGateway,
  PagamentoWebhookEvento,
} from '../tipos'
import {
  aplicarTaxaCartao,
  arredondarDinheiro,
  asaasFetch,
  dataVencimentoIso,
  soDigitos,
} from './client'

type AsaasCustomer = { id?: string }
type AsaasCustomerList = { data?: AsaasCustomer[] }
type AsaasPayment = {
  id?: string
  status?: string
  value?: number
  invoiceUrl?: string
  bankSlipUrl?: string
}
type AsaasPixQr = {
  encodedImage?: string
  payload?: string
  expirationDate?: string
}

function mapStatus(raw: string | undefined): PagamentoCobrancaStatus {
  const s = String(raw ?? '').toUpperCase()
  if (s === 'RECEIVED' || s === 'CONFIRMED' || s === 'RECEIVED_IN_CASH') return 'pago'
  if (s === 'OVERDUE' || s === 'EXPIRED') return 'expirado'
  if (s === 'REFUNDED' || s === 'DELETED' || s === 'CANCELLED') return 'cancelado'
  if (s === 'PENDING' || s === 'AWAITING_RISK_ANALYSIS') return 'pendente'
  return 'desconhecido'
}

async function garantirCustomer(
  apiKey: string,
  input: PagamentoCobrancaInput,
): Promise<string> {
  const cpf = soDigitos(input.cliente.cpf)
  const celular = soDigitos(input.cliente.celular)

  if (cpf.length === 11 || cpf.length === 14) {
    const lista = await asaasFetch<AsaasCustomerList>(
      apiKey,
      `/customers?cpfCnpj=${encodeURIComponent(cpf)}`,
    )
    const existente = lista.data?.[0]?.id?.trim()
    if (existente) return existente
  }

  const criado = await asaasFetch<AsaasCustomer>(apiKey, '/customers', {
    method: 'POST',
    body: {
      name: input.cliente.nome || 'Cliente loja',
      ...(cpf.length === 11 || cpf.length === 14 ? { cpfCnpj: cpf } : {}),
      ...(celular.length >= 10 ? { mobilePhone: celular.slice(-11) } : {}),
    },
  })
  const id = String(criado.id ?? '').trim()
  if (!id) throw new Error('Asaas não retornou o cliente.')
  return id
}

async function pixInfo(apiKey: string, paymentId: string) {
  try {
    const qr = await asaasFetch<AsaasPixQr>(apiKey, `/payments/${paymentId}/pixQrCode`)
    const payload = String(qr.payload ?? '').trim()
    if (!payload) return null
    const img = String(qr.encodedImage ?? '').trim()
    return {
      payload,
      qrCodeBase64: img || null,
      expiraEm: qr.expirationDate ? String(qr.expirationDate) : null,
    }
  } catch {
    return null
  }
}

function resultadoDePayment(
  pay: AsaasPayment,
  pix: PagamentoCobrancaResultado['pix'],
): PagamentoCobrancaResultado {
  const cobrancaId = String(pay.id ?? '').trim()
  return {
    cobrancaId,
    status: mapStatus(pay.status),
    valor: arredondarDinheiro(Number(pay.value) || 0),
    pix,
    checkoutUrl: pay.invoiceUrl ? String(pay.invoiceUrl) : null,
  }
}

export function criarAdapterAsaas(apiKey: string): PagamentoGateway {
  return {
    async criarCobranca(input) {
      const customer = await garantirCustomer(apiKey, input)
      const parcelas = Math.max(1, Math.trunc(input.parcelas ?? 1))
      const valor = aplicarTaxaCartao(input.valor, parcelas, input.taxasCartao)
      const billingType = input.billingType === 'pix' ? 'PIX' : 'UNDEFINED'

      const pay = await asaasFetch<AsaasPayment>(apiKey, '/payments', {
        method: 'POST',
        body: {
          customer,
          billingType,
          value: valor,
          dueDate: dataVencimentoIso(billingType === 'PIX' ? 0 : 1),
          description: input.descricao.slice(0, 500),
          externalReference: input.referenciaExterna.slice(0, 100),
          ...(billingType === 'UNDEFINED' && parcelas > 1
            ? { installmentCount: parcelas, installmentValue: arredondarDinheiro(valor / parcelas) }
            : {}),
        },
      })

      const cobrancaId = String(pay.id ?? '').trim()
      if (!cobrancaId) throw new Error('Asaas não retornou a cobrança.')

      const pix = input.billingType === 'pix' ? await pixInfo(apiKey, cobrancaId) : null
      return resultadoDePayment(pay, pix)
    },

    async consultarCobranca(cobrancaId) {
      const pay = await asaasFetch<AsaasPayment>(apiKey, `/payments/${encodeURIComponent(cobrancaId)}`)
      const pix = pay.status && mapStatus(pay.status) === 'pago'
        ? null
        : await pixInfo(apiKey, cobrancaId)
      return resultadoDePayment(pay, pix)
    },

    async cancelarCobranca(cobrancaId) {
      try {
        await asaasFetch(apiKey, `/payments/${encodeURIComponent(cobrancaId)}`, {
          method: 'DELETE',
        })
      } catch {
        // Já cancelada, expirada ou inexistente.
      }
    },

    interpretarWebhook: interpretarWebhookAsaas,
  }
}

export function interpretarWebhookAsaas(body: unknown): PagamentoWebhookEvento | null {
  if (!body || typeof body !== 'object') return null
  const rec = body as Record<string, unknown>
  const event = String(rec.event ?? '').toUpperCase()
  const payment = rec.payment
  if (!payment || typeof payment !== 'object') return null
  const p = payment as Record<string, unknown>
  const cobrancaId = String(p.id ?? '').trim()
  if (!cobrancaId) return null

  let status = mapStatus(String(p.status ?? ''))
  if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') status = 'pago'
  if (event === 'PAYMENT_DELETED' || event === 'PAYMENT_REFUNDED') status = 'cancelado'
  if (event === 'PAYMENT_OVERDUE') status = 'expirado'

  return {
    cobrancaId,
    status,
    referenciaExterna: p.externalReference != null ? String(p.externalReference) : null,
  }
}
