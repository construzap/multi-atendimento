import { createError } from 'h3'
import type { PagamentoGateway } from '../tipos'

export function criarAdapterPagarMe(_apiKey: string): PagamentoGateway {
  const naoPronto = () => {
    throw createError({
      statusCode: 501,
      statusMessage: 'Pagar.me ainda não está disponível nesta loja.',
    })
  }
  return {
    criarCobranca: naoPronto,
    consultarCobranca: naoPronto,
    cancelarCobranca: async () => {},
    interpretarWebhook: () => null,
  }
}
