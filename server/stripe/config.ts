import Stripe from 'stripe'

export type StripeMode = 'test' | 'live'

/** Aceita `STRIPE_*` ou `NUXT_STRIPE_*` (como no seu `.env`). */
function envFirst(...keys: string[]): string {
  for (const key of keys) {
    const v = process.env[key]
    if (typeof v === 'string' && v.trim() !== '') return v.trim()
  }
  return ''
}

export function getStripeMode(): StripeMode {
  const v = envFirst('STRIPE_ENV', 'NUXT_STRIPE_ENV', 'NUXT_PUBLIC_STRIPE_ENV').toLowerCase()
  if (v === 'live' || v === 'production') return 'live'
  return 'test'
}

export function getStripeSecretKey(): string {
  const mode = getStripeMode()
  const key =
    mode === 'live'
      ? envFirst('STRIPE_LIVE_SECRET_KEY', 'NUXT_STRIPE_LIVE_SECRET_KEY')
      : envFirst('STRIPE_TEST_SECRET_KEY', 'NUXT_STRIPE_TEST_SECRET_KEY')
  if (!key) {
    throw new Error(
      mode === 'live'
        ? 'Chave secreta live não configurada (STRIPE_LIVE_SECRET_KEY ou NUXT_STRIPE_LIVE_SECRET_KEY)'
        : 'Chave secreta de teste não configurada (STRIPE_TEST_SECRET_KEY ou NUXT_STRIPE_TEST_SECRET_KEY)'
    )
  }
  return key
}

export function getStripePriceId(): string {
  const mode = getStripeMode()
  const id =
    mode === 'live'
      ? envFirst('STRIPE_LIVE_PRICE_ID', 'NUXT_STRIPE_LIVE_PRICE_ID')
      : envFirst('STRIPE_TEST_PRICE_ID', 'NUXT_STRIPE_TEST_PRICE_ID')
  if (!id) {
    throw new Error(
      mode === 'live'
        ? 'Price ID live não configurado (STRIPE_LIVE_PRICE_ID ou NUXT_STRIPE_LIVE_PRICE_ID)'
        : 'Price ID de teste não configurado (STRIPE_TEST_PRICE_ID ou NUXT_STRIPE_TEST_PRICE_ID)'
    )
  }
  return id
}

export function createStripeClient(): Stripe {
  return new Stripe(getStripeSecretKey())
}

export function getStripeWebhookSecret(): string {
  const mode = getStripeMode()
  const secret =
    mode === 'live'
      ? envFirst('STRIPE_LIVE_WEBHOOK_SECRET', 'NUXT_STRIPE_LIVE_WEBHOOK_SECRET')
      : envFirst('STRIPE_TEST_WEBHOOK_SECRET', 'NUXT_STRIPE_TEST_WEBHOOK_SECRET')
  if (!secret) {
    throw new Error(
      mode === 'live'
        ? 'Webhook secret live não configurado (cole o whsec_ do Stripe em STRIPE_LIVE_WEBHOOK_SECRET ou NUXT_STRIPE_LIVE_WEBHOOK_SECRET)'
        : 'Webhook secret de teste não configurado (cole o whsec_ do Stripe em STRIPE_TEST_WEBHOOK_SECRET ou NUXT_STRIPE_TEST_WEBHOOK_SECRET)'
    )
  }
  return secret
}
