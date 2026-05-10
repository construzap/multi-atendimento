import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError, readBody, getRequestURL } from 'h3'
import type { StatusAssinatura } from '#shared/types/profile'
import { getAuthUserId } from '../../utils/getAuthUserId'
import { createStripeClient, getStripePriceId } from '../../stripe/config'
import { ensureStripeCustomer } from '../../stripe/ensureStripeCustomer'
import { stripeCheckoutMetadata } from '../../stripe/metadata'

type CheckoutBody = {
  success_url?: string
  cancel_url?: string
  /** Número de pacotes (cada um inclui o Price configurado no Stripe; quantity da linha). */
  quantity?: number
  pacotes?: number
}

export type StripeCheckoutResponse = {
  url: string
}

/**
 * Estados em que **não** abrimos Checkout (assinatura vigente; gerenciamento será pelo portal).
 */
function isSomentePortal(status: StatusAssinatura | null): boolean {
  return status === 'ativo'
}

/**
 * POST /api/stripe/checkout
 * Cria sessão de Checkout (assinatura). Garante `profiles.customer` e Customer na Stripe.
 * Bloqueado quando `status_assinatura === ativo` (use portal depois).
 */
export default defineEventHandler(async (event): Promise<StripeCheckoutResponse> => {
  const client = await serverSupabaseClient(event)
  const { data: authData, error: authError } = await client.auth.getUser()

  if (authError || !authData.user) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const user = authData.user
  const userId = getAuthUserId(user)
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  let stripe: ReturnType<typeof createStripeClient>
  let priceId: string
  try {
    stripe = createStripeClient()
    priceId = getStripePriceId()
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Stripe não configurado'
    throw createError({ statusCode: 500, statusMessage: msg })
  }

  const admin = serverSupabaseServiceRole<any>(event)
  const { data: consolidado, error: viewError } = await admin
    .from('vw_perfil_consolidado')
    .select('status_assinatura')
    .eq('user_id', userId)
    .maybeSingle()

  if (viewError) {
    throw createError({ statusCode: 500, statusMessage: viewError.message })
  }

  const statusRaw = consolidado?.status_assinatura as string | null | undefined
  const status: StatusAssinatura | null =
    statusRaw === null || statusRaw === undefined || statusRaw === ''
      ? null
      : (statusRaw as StatusAssinatura)

  if (isSomentePortal(status)) {
    throw createError({
      statusCode: 409,
      statusMessage:
        'Assinatura ativa. Use o portal do cliente para gerenciar cobrança e plano.'
    })
  }

  const body =
    ((await readBody<CheckoutBody>(event).catch(() => ({}))) ?? {}) as CheckoutBody
  const requestUrl = getRequestURL(event)
  const origin = requestUrl.origin

  let successUrl = typeof body.success_url === 'string' ? body.success_url.trim() : ''
  let cancelUrl = typeof body.cancel_url === 'string' ? body.cancel_url.trim() : ''

  if (!successUrl) {
    successUrl = `${origin}/assinatura?checkout=success`
  }
  if (!cancelUrl) {
    cancelUrl = `${origin}/assinatura?checkout=cancel`
  }

  let parsedSuccess: URL
  let parsedCancel: URL
  try {
    parsedSuccess = new URL(successUrl)
    parsedCancel = new URL(cancelUrl)
  } catch {
    throw createError({
      statusCode: 400,
      statusMessage: 'success_url e cancel_url devem ser URLs válidas.'
    })
  }

  if (parsedSuccess.origin !== origin || parsedCancel.origin !== origin) {
    throw createError({
      statusCode: 400,
      statusMessage: 'As URLs de retorno devem ser do mesmo domínio da aplicação.'
    })
  }

  const rawQty = body.quantity ?? body.pacotes ?? 1
  const pacotes = Math.floor(Number(rawQty))
  if (!Number.isFinite(pacotes) || pacotes < 1 || pacotes > 100) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Informe uma quantidade de pacotes entre 1 e 100.'
    })
  }

  let customerId: string
  try {
    customerId = await ensureStripeCustomer(event, stripe, userId, user)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Falha ao garantir cliente Stripe'
    throw createError({ statusCode: 500, statusMessage: msg })
  }

  try {
    const meta = stripeCheckoutMetadata(userId, pacotes)

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: pacotes }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      /** Redundante com metadata; útil em integrações que só leem `client_reference_id`. */
      client_reference_id: userId,
      metadata: meta,
      subscription_data: {
        metadata: meta
      }
    })

    const url = session.url
    if (!url) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Stripe não retornou URL de checkout.'
      })
    }

    return { url }
  } catch (e: unknown) {
    const msg =
      e && typeof e === 'object' && 'message' in e
        ? String((e as { message?: string }).message)
        : 'Erro ao criar sessão de checkout'
    throw createError({ statusCode: 502, statusMessage: msg })
  }
})
