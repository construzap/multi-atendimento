import { readRawBody, getHeader, createError } from 'h3'
import Stripe from 'stripe'
import { getStripeWebhookSecret } from '../../stripe/config'
import { handleInvoicePaymentSucceeded } from '../../stripe/handleInvoicePaymentSucceeded'

/**
 * POST /api/stripe/webhookstripe
 * Valida assinatura Stripe (`stripe-signature`) e processa eventos.
 *
 * `invoice.payment_succeeded`: atualiza `profiles.canais`, `data_expiracao`, `subscription_id`.
 */
export default defineEventHandler(async (event) => {
  const raw = await readRawBody(event)
  const texto =
    typeof raw === 'string'
      ? raw
      : raw
        ? Buffer.from(raw).toString('utf8')
        : ''

  const sig = getHeader(event, 'stripe-signature')
  if (!sig) {
    throw createError({ statusCode: 400, message: 'Cabeçalho stripe-signature ausente.' })
  }

  let stripeEvent: Stripe.Event
  try {
    const webhookSecret = getStripeWebhookSecret()
    stripeEvent = Stripe.webhooks.constructEvent(texto, sig, webhookSecret)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Falha na verificação do webhook'
    console.error('[stripe webhookstripe]', msg)
    throw createError({ statusCode: 400, message: msg })
  }

  if (stripeEvent.type === 'invoice.payment_succeeded') {
    try {
      await handleInvoicePaymentSucceeded(event, stripeEvent)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao processar invoice.payment_succeeded'
      console.error('[stripe webhookstripe]', msg)
      throw createError({ statusCode: 500, message: msg })
    }
  }

  return { received: true }
})
