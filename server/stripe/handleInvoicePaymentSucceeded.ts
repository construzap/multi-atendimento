import type Stripe from 'stripe'
import type { H3Event } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { CANAIS_POR_PACOTE } from './constants'

type SubscriptionParent = {
  type?: string
  subscription_details?: {
    metadata?: Record<string, string | undefined>
    subscription?: string
  }
}

function resolveUserId(invoice: Stripe.Invoice): string | null {
  const parent = invoice.parent as SubscriptionParent | null | undefined
  const fromParent = parent?.subscription_details?.metadata?.user_id?.trim()
  if (fromParent) return fromParent

  for (const line of invoice.lines?.data ?? []) {
    const uid = line.metadata?.user_id?.trim()
    if (uid) return uid
  }
  return null
}

function lineHasSubscriptionItem(line: Stripe.InvoiceLineItem): boolean {
  const p = line.parent
  return Boolean(p && typeof p === 'object' && 'subscription_item_details' in p)
}

/**
 * Pacotes contratados na assinatura.
 *
 * Em **`subscription_update`** (upgrade/downgrade no portal) há linhas de proration:
 * crédito “Unused time on **N** ×” (quantity antiga, amount ≤ 0) e cobrança “Remaining time on **M** ×”
 * (quantity **nova**, amount > 0). O pacote atual é **M**, não `max(N, M)` — upgrade e downgrade.
 * Metadados da subscription podem estar defasados; não confiar só neles.
 *
 * Em faturas com **uma linha**, somar ou metadata costuma bastar.
 */
function resolvePacotesQuantity(invoice: Stripe.Invoice): number {
  const lines = invoice.lines?.data ?? []
  const billingReason = invoice.billing_reason

  if (billingReason === 'subscription_update') {
    const positiveSubQtys = lines
      .filter(
        (l) =>
          lineHasSubscriptionItem(l) &&
          typeof l.amount === 'number' &&
          l.amount > 0 &&
          typeof l.quantity === 'number' &&
          l.quantity >= 1
      )
      .map((l) => l.quantity as number)
    if (positiveSubQtys.length > 0) {
      return Math.max(...positiveSubQtys)
    }

    // Total R$ 0 no cartão mas proration presente: prioriza linha “Remaining time …”
    const remainingByDesc = lines.filter(
      (l) =>
        lineHasSubscriptionItem(l) &&
        typeof l.description === 'string' &&
        /\bremaining\s+time\s+on\b/i.test(l.description) &&
        typeof l.quantity === 'number' &&
        l.quantity >= 1
    )
    if (remainingByDesc.length > 0) {
      return Math.max(...remainingByDesc.map((l) => l.quantity as number))
    }

    const positiveQty = lines
      .filter(
        (l) =>
          typeof l.amount === 'number' &&
          l.amount > 0 &&
          typeof l.quantity === 'number' &&
          l.quantity >= 1
      )
      .map((l) => l.quantity as number)
    if (positiveQty.length > 0) {
      return Math.max(...positiveQty)
    }
  }

  const parent = invoice.parent as SubscriptionParent | null | undefined
  const pacotesStr = parent?.subscription_details?.metadata?.pacotes?.trim()
  if (pacotesStr) {
    const n = parseInt(pacotesStr, 10)
    if (Number.isFinite(n) && n >= 1) return n
  }

  let sum = 0
  for (const line of lines) {
    const q = line.quantity
    if (typeof q === 'number' && q > 0) sum += q
  }
  if (sum >= 1) return sum

  const fallback = lines[0]?.quantity
  if (typeof fallback === 'number' && fallback >= 1) return fallback

  return 1
}

/** Fim do período pago atual (usa o maior entre linhas e `invoice.period_end`). */
function resolvePeriodEndUnix(invoice: Stripe.Invoice): number | null {
  let maxEnd = 0
  for (const line of invoice.lines?.data ?? []) {
    const e = line.period?.end
    if (typeof e === 'number' && e > maxEnd) maxEnd = e
  }
  const invEnd = invoice.period_end
  if (typeof invEnd === 'number' && invEnd > maxEnd) maxEnd = invEnd

  return maxEnd > 0 ? maxEnd : null
}

function resolveSubscriptionId(invoice: Stripe.Invoice): string | null {
  const parent = invoice.parent as SubscriptionParent | null | undefined
  const sid = parent?.subscription_details?.subscription?.trim()
  if (sid) return sid

  const root = (invoice as Stripe.Invoice & { subscription?: string | null }).subscription
  if (typeof root === 'string' && root.length > 0) return root

  const subFromLine = invoice.lines?.data?.[0]?.parent
  if (
    subFromLine &&
    typeof subFromLine === 'object' &&
    'subscription_item_details' in subFromLine
  ) {
    const details = subFromLine as { subscription_item_details?: { subscription?: string } }
    const s = details.subscription_item_details?.subscription?.trim()
    if (s) return s
  }

  return null
}

/**
 * Atualiza `profiles` após pagamento confirmado da fatura da assinatura.
 */
export async function handleInvoicePaymentSucceeded(
  event: H3Event,
  stripeEvent: Stripe.Event
): Promise<void> {
  const invoice = stripeEvent.data.object as Stripe.Invoice

  const userId = resolveUserId(invoice)
  if (!userId) {
    console.warn('[stripe] invoice.payment_succeeded sem user_id nos metadados — ignorado.')
    return
  }

  const pacotes = resolvePacotesQuantity(invoice)
  const canais = pacotes * CANAIS_POR_PACOTE

  const periodEndUnix = resolvePeriodEndUnix(invoice)
  if (periodEndUnix === null) {
    console.warn('[stripe] invoice.payment_succeeded sem period_end — ignorado.', invoice.id)
    return
  }

  const dataExpiracao = new Date(periodEndUnix * 1000).toISOString()
  const subscriptionId = resolveSubscriptionId(invoice)

  const admin = serverSupabaseServiceRole<any>(event)

  const updatePayload: Record<string, unknown> = {
    canais,
    data_expiracao: dataExpiracao
  }
  if (subscriptionId) {
    updatePayload.subscription_id = subscriptionId
  }

  const { error } = await admin.from('profiles').update(updatePayload).eq('user_id', userId)

  if (error) {
    console.error('[stripe] erro ao atualizar profiles:', error.message)
    throw new Error(error.message)
  }

  console.log('[stripe] profiles atualizado:', {
    userId,
    pacotes,
    canais,
    data_expiracao: dataExpiracao,
    subscription_id: subscriptionId ?? null,
    invoice_id: invoice.id
  })
}
