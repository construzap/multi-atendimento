/**
 * Metadado Stripe com o UUID do usuário no Supabase Auth (`auth.users.id` / `profiles.user_id`).
 *
 * Nos webhooks, leia esta chave em:
 * - `checkout.session.completed` → `session.metadata[user_id]` e `session.client_reference_id` (mesmo UUID)
 * - `customer.subscription.*` → `subscription.metadata[user_id]`
 * - `invoice.*` → expandir `subscription` ou usar `customer` + metadata no Customer
 */
export const STRIPE_METADATA_USER_ID_KEY = 'user_id' as const

export function stripeUserIdMetadata(userId: string): Record<string, string> {
  return { [STRIPE_METADATA_USER_ID_KEY]: userId }
}

/** Quantidade de pacotes contratados no Checkout (cada pacote = mesma quantidade no `line_items`). */
export const STRIPE_METADATA_PACOTES_KEY = 'pacotes' as const

export function stripeCheckoutMetadata(userId: string, pacotes: number): Record<string, string> {
  return {
    ...stripeUserIdMetadata(userId),
    [STRIPE_METADATA_PACOTES_KEY]: String(pacotes)
  }
}
