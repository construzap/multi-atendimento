import { createError } from 'h3'
import type { CanalProvedorPagamentos } from '#shared/types/canal'
import { criarAdapterAsaas } from './asaas/adapter'
import { criarAdapterPagarMe } from './pagarMe/adapter'
import type { PagamentoGateway } from './tipos'

export function resolverGatewayPagamento(
  provedor: CanalProvedorPagamentos | null,
  apiKey: string,
): PagamentoGateway {
  if (provedor === 'asaas') return criarAdapterAsaas(apiKey)
  if (provedor === 'pagar.me') return criarAdapterPagarMe(apiKey)
  if (provedor === 'pix_manual') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Este canal usa PIX manual. Pagamento online automático não está disponível.',
    })
  }
  throw createError({
    statusCode: 400,
    statusMessage: 'Provedor de pagamento não configurado neste canal.',
  })
}
