export type PagamentoBillingType = 'pix' | 'cartao_credito'

export type PagamentoCobrancaStatus =
  | 'pendente'
  | 'pago'
  | 'expirado'
  | 'cancelado'
  | 'desconhecido'

export type PagamentoCliente = {
  nome: string
  cpf: string
  celular: string
}

export type PagamentoCobrancaInput = {
  valor: number
  descricao: string
  referenciaExterna: string
  cliente: PagamentoCliente
  billingType: PagamentoBillingType
  parcelas?: number
  /** Percentual por parcela (`taxas_cartao` do canal), ex.: `{ "2x": 4.5 }`. */
  taxasCartao?: Record<string, number>
}

export type PagamentoPixInfo = {
  payload: string
  qrCodeBase64: string | null
  expiraEm: string | null
}

export type PagamentoCobrancaResultado = {
  cobrancaId: string
  status: PagamentoCobrancaStatus
  valor: number
  pix: PagamentoPixInfo | null
  checkoutUrl: string | null
}

export type PagamentoWebhookEvento = {
  cobrancaId: string
  status: PagamentoCobrancaStatus
  referenciaExterna: string | null
}

export type PagamentoGateway = {
  criarCobranca: (input: PagamentoCobrancaInput) => Promise<PagamentoCobrancaResultado>
  consultarCobranca: (cobrancaId: string) => Promise<PagamentoCobrancaResultado>
  cancelarCobranca: (cobrancaId: string) => Promise<void>
  interpretarWebhook: (body: unknown) => PagamentoWebhookEvento | null
}
