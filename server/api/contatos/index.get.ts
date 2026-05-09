import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError, getQuery } from 'h3'
import type { Contato, ContatosListResponse } from '#shared/types/contato'
import { checkChannels } from '../../utils/checkChannel'
import { getAuthUserId } from '../../utils/getAuthUserId'

const SELECT = 'key, name, created_at, updated_at, photo, id_canal, phone, lid'

function parseCanalIds(raw: unknown): number[] {
  if (raw == null) return []

  const list: string[] = Array.isArray(raw) ? raw.map((x) => String(x)) : [String(raw)]

  // aceita "1,2,3" ou ["1","2","3"]
  const parts = list
    .flatMap((s) => s.split(','))
    .map((s) => s.trim())
    .filter(Boolean)

  const ids = parts
    .map((s) => Number.parseInt(s, 10))
    .filter((n) => Number.isFinite(n) && Number.isInteger(n) && n > 0)

  // dedup mantendo ordem
  const seen = new Set<number>()
  const out: number[] = []
  for (const id of ids) {
    if (seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

/**
 * GET /api/contatos?canais=1,2,3
 * Também aceita `id_canal`/`id_canais` como alias.
 *
 * Retorna contatos a partir da tabela `conversas` (campos básicos).
 */
export default defineEventHandler(async (event): Promise<ContatosListResponse> => {
  const client = await serverSupabaseClient(event)
  const { data: authData, error: authError } = await client.auth.getUser()

  if (authError || !authData.user) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const userId = getAuthUserId(authData.user)
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const q = getQuery(event)
  const canalIds = parseCanalIds((q as any).canais ?? (q as any).id_canais ?? (q as any).id_canal)

  if (!canalIds.length) {
    throw createError({ statusCode: 400, statusMessage: 'Informe canais na query (ex.: canais=1,2,3).' })
  }

  const allowed = await checkChannels(event, canalIds, userId)
  if (!allowed) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Um ou mais canais não foram encontrados ou você não tem permissão.',
    })
  }

  const admin = serverSupabaseServiceRole<any>(event)
  const { data, error } = await admin
    .from('conversas')
    .select(SELECT)
    .in('id_canal', canalIds)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return { data: (data ?? []) as Contato[] }
})

