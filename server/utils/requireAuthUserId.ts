import { serverSupabaseClient } from '#supabase/server'
import { createError } from 'h3'
import type { H3Event } from 'h3'
import { getAuthUserId } from './getAuthUserId'

export async function requireAuthUserId(event: H3Event): Promise<string> {
  const client = await serverSupabaseClient(event)
  const { data: authData, error: authError } = await client.auth.getUser()

  if (authError || !authData.user) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const userId = getAuthUserId(authData.user)
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  return userId
}
