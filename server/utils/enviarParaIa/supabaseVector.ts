import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createError } from 'h3'
import type { H3Event } from 'h3'

let cachedClient: SupabaseClient | null = null

export function getSupabaseVectorClient(event: H3Event): SupabaseClient {
  const config = useRuntimeConfig(event)
  const url = String(config.vectorSupabaseUrl ?? '').trim()
  const key = String(config.vectorSupabaseSecretKey ?? '').trim()

  if (!url || !key) {
    throw createError({
      statusCode: 500,
      statusMessage:
        'Vector Supabase não configurado. Defina NUXT_VECTOR_SUPABASE_URL e NUXT_VECTOR_SUPABASE_SECRET_KEY no .env.',
    })
  }

  if (!cachedClient) {
    cachedClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }

  return cachedClient
}
