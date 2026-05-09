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

/**
 * Versão batch: verifica se o usuário é dono de TODOS os canais informados.
 * Mantém compatibilidade com `checkChannel` (usada em outros endpoints).
 */
export async function checkChannels(
  event: H3Event,
  canalIds: number[],
  userId: string
): Promise<boolean> {
  const ids = Array.from(new Set((canalIds ?? []).filter((x) => Number.isFinite(x) && Number.isInteger(x) && x > 0)))
  if (!ids.length) return false

  const admin = serverSupabaseServiceRole<any>(event)

  const { data, error } = await admin
    .from('canais')
    .select('id')
    .in('id', ids)
    .eq('user_id', userId)

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message
    })
  }

  const found = new Set((data ?? []).map((r: any) => r?.id).filter((x: any) => typeof x === 'number'))
  return ids.every((id) => found.has(id))
}
