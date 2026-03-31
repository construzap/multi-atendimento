import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError } from 'h3'
import type { UserProfile } from '#shared/types/profile'

/**
 * GET /api/perfil/me
 * Retorna o perfil do usuário logado (`public.profiles`), filtrado por `user_id` (UUID do auth).
 * A leitura usa `serverSupabaseServiceRole` (SUPABASE_SECRET_KEY / service role), conforme docs.
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

  // Tipos do DB ainda não configurados (Database = unknown), então usamos any aqui.
  const admin = serverSupabaseServiceRole<any>(event)
  const { data, error } = await admin
    .from('profiles')
    .select('created_at, email, full_name, whatsapp')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message
    })
  }

  if (!data) {
    const fullName =
      (user.user_metadata?.full_name as string | undefined) ??
      (user.user_metadata?.name as string | undefined) ??
      null

    const whatsapp =
      (user.user_metadata?.whatsapp as string | undefined) ??
      (user.user_metadata?.phone as string | undefined) ??
      null

    const { error: upsertError } = await admin
      .from('profiles')
      .upsert(
        {
          user_id: userId,
          email: user.email ?? '',
          full_name: fullName,
          whatsapp
        },
        { onConflict: 'user_id' }
      )

    if (upsertError) {
      throw createError({
        statusCode: 500,
        statusMessage: upsertError.message
      })
    }

    const { data: created, error: createdError } = await admin
      .from('profiles')
      .select('created_at, email, full_name, whatsapp')
      .eq('user_id', userId)
      .single()

    if (createdError) {
      throw createError({
        statusCode: 500,
        statusMessage: createdError.message
      })
    }

    return created as UserProfile
  }

  return data as UserProfile
})
