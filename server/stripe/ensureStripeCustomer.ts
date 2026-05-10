import type Stripe from 'stripe'
import type { H3Event } from 'h3'
import type { User } from '@supabase/supabase-js'
import { serverSupabaseServiceRole } from '#supabase/server'
import { stripeUserIdMetadata } from './metadata'

/** IDs de Customer Stripe (`cus_...`). */
const CUSTOMER_ID_RE = /^cus_[a-zA-Z0-9]+$/

export async function ensureStripeCustomer(
  event: H3Event,
  stripe: Stripe,
  userId: string,
  user: User
): Promise<string> {
  const admin = serverSupabaseServiceRole<any>(event)

  let { data: profile, error } = await admin
    .from('profiles')
    .select('customer, email, full_name')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  if (!profile) {
    const fullName =
      (user.user_metadata?.full_name as string | undefined) ??
      (user.user_metadata?.name as string | undefined) ??
      null
    const whatsapp =
      (user.user_metadata?.whatsapp as string | undefined) ??
      (user.user_metadata?.phone as string | undefined) ??
      null

    const { error: upsertError } = await admin.from('profiles').upsert(
      {
        user_id: userId,
        email: user.email ?? '',
        full_name: fullName,
        whatsapp
      },
      { onConflict: 'user_id' }
    )
    if (upsertError) {
      throw new Error(upsertError.message)
    }

    const again = await admin
      .from('profiles')
      .select('customer, email, full_name')
      .eq('user_id', userId)
      .single()

    if (again.error || !again.data) {
      throw new Error(again.error?.message ?? 'Perfil não encontrado após criação.')
    }
    profile = again.data
  }

  const raw = profile.customer as string | null | undefined
  if (raw && CUSTOMER_ID_RE.test(raw.trim())) {
    return raw.trim()
  }

  const email =
    (typeof profile.email === 'string' && profile.email.trim() !== ''
      ? profile.email.trim()
      : null) ?? user.email ??
    ''

  const fullName = typeof profile.full_name === 'string' ? profile.full_name.trim() : ''
  const customer = await stripe.customers.create({
    email: email || undefined,
    name: fullName.length > 0 ? fullName : undefined,
    metadata: stripeUserIdMetadata(userId)
  })

  const { error: updateError } = await admin
    .from('profiles')
    .update({ customer: customer.id })
    .eq('user_id', userId)

  if (updateError) {
    throw new Error(updateError.message)
  }

  return customer.id
}
