import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError, readBody } from 'h3'
import type { UserProfile } from '#shared/types/profile'

type UpdateMeBody = {
  full_name?: string | null
  whatsapp?: string | null
}

/**
 * PATCH /api/perfil/me
 * Atualiza apenas `full_name` e/ou `whatsapp` do usuário logado em `public.profiles`.
 * A escrita usa `serverSupabaseServiceRole` (SUPABASE_SECRET_KEY / service role), conforme docs.
 */
export default defineEventHandler(async (event): Promise<UserProfile> => {
  const client = await serverSupabaseClient(event)
  const { data: authData, error: authError } = await client.auth.getUser()

  if (authError || !authData.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Não autenticado'
    })
  }

  const user = authData.user
  const userId = user.id

  const body = (await readBody<UpdateMeBody>(event)) ?? {}

  const hasFullName = Object.prototype.hasOwnProperty.call(body, 'full_name')
  const hasWhatsapp = Object.prototype.hasOwnProperty.call(body, 'whatsapp')

  if (!hasFullName && !hasWhatsapp) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Envie full_name e/ou whatsapp'
    })
  }

  if (hasFullName && body.full_name !== null && typeof body.full_name !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'full_name inválido' })
  }

  if (hasWhatsapp && body.whatsapp !== null && typeof body.whatsapp !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'whatsapp inválido' })
  }

  // Tipos do DB ainda não configurados (Database = unknown), então usamos any aqui.
  const admin = serverSupabaseServiceRole<any>(event)

  // Garante que o profile exista (mesma lógica do GET).
  const { error: ensureError } = await admin.from('profiles').upsert(
    {
      user_id: userId,
      email: user.email ?? '',
      full_name:
        (user.user_metadata?.full_name as string | undefined) ??
        (user.user_metadata?.name as string | undefined) ??
        null,
      whatsapp:
        (user.user_metadata?.whatsapp as string | undefined) ??
        (user.user_metadata?.phone as string | undefined) ??
        null
    },
    { onConflict: 'user_id' }
  )

  if (ensureError) {
    throw createError({ statusCode: 500, statusMessage: ensureError.message })
  }

  const updatePayload: Record<string, unknown> = {}
  if (hasFullName) updatePayload.full_name = body.full_name
  if (hasWhatsapp) updatePayload.whatsapp = body.whatsapp

  const { error: updateError } = await admin.from('profiles').update(updatePayload).eq('user_id', userId)

  if (updateError) {
    throw createError({ statusCode: 500, statusMessage: updateError.message })
  }

  const { data: updated, error: updatedError } = await admin
    .from('profiles')
    .select('created_at, email, full_name, whatsapp')
    .eq('user_id', userId)
    .single()

  if (updatedError) {
    throw createError({ statusCode: 500, statusMessage: updatedError.message })
  }

  return updated as UserProfile
})

