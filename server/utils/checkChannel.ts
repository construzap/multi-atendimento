import { serverSupabaseServiceRole } from '#supabase/server'
import { createError } from 'h3'
import type { H3Event } from 'h3'

/**
 * Verifica se o usuário é dono do canal: existe linha em `public.canais`
 * com o `id` informado e `user_id` igual ao passado.
 *
 * @returns `true` se houver pelo menos uma linha; `false` caso contrário.
 */
export async function checkChannel(
  event: H3Event,
  canalId: number,
  userId: string
): Promise<boolean> {
  const admin = serverSupabaseServiceRole<any>(event)

  const { data, error } = await admin
    .from('canais')
    .select('id')
    .eq('id', canalId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message
    })
  }

  return data != null
}
