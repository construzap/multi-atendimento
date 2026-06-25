import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import type { EnfileirarFilaDisparoResponse, FilaDisparoRow } from '#shared/types/disparoEmMassa'
import { assertMethod, createError, readBody } from 'h3'
import { checkChannel } from '../../../utils/checkChannel'
import { getAuthUserId } from '../../../utils/getAuthUserId'

const FILA_LOTE_MAX = 10

type Body = Record<string, unknown>

function parseCampanhaId(raw: unknown): string {
  const s = String(raw ?? '').trim()
  if (!s) {
    throw createError({ statusCode: 400, statusMessage: 'campanha_id é obrigatório.' })
  }
  return s
}

function parseConversaKeys(raw: unknown): string[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Informe conversa_keys.' })
  }
  if (raw.length > FILA_LOTE_MAX) {
    throw createError({
      statusCode: 400,
      statusMessage: `Envie no máximo ${FILA_LOTE_MAX} conversa_keys por requisição.`,
    })
  }
  const keys = raw
    .map((item) => String(item ?? '').trim())
    .filter((k) => k.length > 0)
  if (keys.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'conversa_keys inválido.' })
  }
  return [...new Set(keys)]
}

/**
 * POST /api/kanban/disparo_em_massa/fila
 *
 * Insere até 10 linhas em `fila_disparos` para uma campanha existente.
 */
export default defineEventHandler(async (event): Promise<EnfileirarFilaDisparoResponse> => {
  assertMethod(event, 'POST')

  const client = await serverSupabaseClient(event)
  const { data: authData, error: authError } = await client.auth.getUser()
  if (authError || !authData.user) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const userId = getAuthUserId(authData.user)
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const body = (await readBody<Body>(event).catch(() => null)) ?? {}
  const campanha_id = parseCampanhaId(body.campanha_id)
  const conversa_keys = parseConversaKeys(body.conversa_keys)

  const admin = serverSupabaseServiceRole<any>(event)

  const { data: campanha, error: campanhaErr } = await admin
    .from('campanhas')
    .select('id, canal_id')
    .eq('id', campanha_id)
    .maybeSingle()

  if (campanhaErr) {
    throw createError({ statusCode: 500, statusMessage: campanhaErr.message })
  }
  if (!campanha) {
    throw createError({ statusCode: 404, statusMessage: 'Campanha não encontrada.' })
  }

  const canalIdRaw = (campanha as { canal_id?: unknown }).canal_id
  const canalId =
    typeof canalIdRaw === 'number' ? canalIdRaw : canalIdRaw != null ? Number(canalIdRaw) : NaN
  if (!Number.isFinite(canalId) || !Number.isInteger(canalId) || canalId < 1) {
    throw createError({ statusCode: 400, statusMessage: 'Campanha sem canal válido.' })
  }

  const canalOk = await checkChannel(event, canalId, userId)
  if (!canalOk) {
    throw createError({ statusCode: 403, statusMessage: 'Sem permissão para esta campanha.' })
  }

  const linhasFila = conversa_keys.map((conversa_key) => ({
    campanha_id,
    conversa_key,
    status: 'pendente' as const,
  }))

  const { data: filaInsert, error: filaErr } = await admin
    .from('fila_disparos')
    .insert(linhasFila)
    .select('id, campanha_id, conversa_key, status, agendado_para, mensagem_erro, enviado_em, criado_em')

  if (filaErr) {
    throw createError({
      statusCode: 500,
      statusMessage: filaErr.message ?? 'Não foi possível enfileirar os disparos.',
    })
  }

  const fila_disparos = (filaInsert ?? []) as FilaDisparoRow[]

  return {
    inseridos: fila_disparos.length,
    fila_disparos,
  }
})
