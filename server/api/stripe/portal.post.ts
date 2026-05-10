import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError, readBody, getRequestURL } from 'h3'
import type { StatusAssinatura } from '#shared/types/profile'
import { getAuthUserId } from '../../utils/getAuthUserId'
import { createStripeClient } from '../../stripe/config'
import { ensureStripeCustomer } from '../../stripe/ensureStripeCustomer'

type PortalBody = {
  return_url?: string
}

export type StripePortalResponse = {
  url: string
}

/**
 * POST /api/stripe/portal
 * Abre o Billing Portal do Stripe para o Customer logado.
 * Permitido apenas com assinatura **ativa** (`status_assinatura === ativo`).
 */
export default defineEventHandler(async (event): Promise<StripePortalResponse> => {
  const client = await serverSupabaseClient(event)
  const { data: authData, error: authError } = await client.auth.getUser()

  if (authError || !authData.user) {
    throw createError({ statusCode: 401, message: 'Não autenticado' })
  }

  const user = authData.user
  const userId = getAuthUserId(user)
  if (!userId) {
    throw createError({ statusCode: 401, message: 'Não autenticado' })
  }

  let stripe: ReturnType<typeof createStripeClient>
  try {
    stripe = createStripeClient()
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Stripe não configurado'
    throw createError({ statusCode: 500, message: msg })
  }

  const admin = serverSupabaseServiceRole<any>(event)
  const { data: consolidado, error: viewError } = await admin
    .from('vw_perfil_consolidado')
    .select('status_assinatura')
    .eq('user_id', userId)
    .maybeSingle()

  if (viewError) {
    throw createError({ statusCode: 500, message: viewError.message })
  }

  const statusRaw = consolidado?.status_assinatura as string | null | undefined
  const status: StatusAssinatura | null =
    statusRaw === null || statusRaw === undefined || statusRaw === ''
      ? null
      : (statusRaw as StatusAssinatura)

  if (status !== 'ativo') {
    throw createError({
      statusCode: 409,
      message: 'O portal do cliente só está disponível com assinatura ativa.'
    })
  }

  const body = ((await readBody<PortalBody>(event).catch(() => ({}))) ?? {}) as PortalBody
  const requestUrl = getRequestURL(event)
  const origin = requestUrl.origin

  let returnUrl = typeof body.return_url === 'string' ? body.return_url.trim() : ''
  if (!returnUrl) {
    returnUrl = `${origin}/assinatura`
  }

  let parsedReturn: URL
  try {
    parsedReturn = new URL(returnUrl)
  } catch {
    throw createError({ statusCode: 400, message: 'return_url deve ser uma URL válida.' })
  }

  if (parsedReturn.origin !== origin) {
    throw createError({
      statusCode: 400,
      message: 'return_url deve ser do mesmo domínio da aplicação.'
    })
  }

  let customerId: string
  try {
    customerId = await ensureStripeCustomer(event, stripe, userId, user)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Falha ao localizar cliente Stripe'
    throw createError({ statusCode: 500, message: msg })
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl
    })

    const url = session.url
    if (!url) {
      throw createError({
        statusCode: 500,
        message: 'Stripe não retornou URL do portal.'
      })
    }

    return { url }
  } catch (e: unknown) {
    const msg =
      e && typeof e === 'object' && 'message' in e
        ? String((e as { message?: string }).message)
        : 'Erro ao criar sessão do portal'
    throw createError({ statusCode: 502, message: msg })
  }
})
