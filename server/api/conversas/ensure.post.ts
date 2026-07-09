import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import type { Conversa } from '#shared/types/conversa'
import { normalizeWhatsappBr } from '#shared/utils/normalizeWhatsappBr'
import { checkChannel } from '../../utils/checkChannel'
import { getAuthUserId } from '../../utils/getAuthUserId'

export const CODIGO_COLUNA_ORIGEM_LEADS_NAO_CONFIGURADA = 'COLUNA_ORIGEM_LEADS_NAO_CONFIGURADA'

type Body = {
  id_canal?: unknown
  telefone?: unknown
}

type SupabaseAdmin = ReturnType<typeof serverSupabaseServiceRole<any>>

const CONVERSA_SELECT =
  'key, message, messatype, name, created_at, updated_at, id_canal, phone, lid, connect_phone, photo, from_me, media_url, conversa_aberta, is_group, id_group, name_group, nao_lidas, funil_id, coluna_id, atendente_id'

function toInt(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === '') return null
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return null
  return n
}

function normalizeAndValidatePhone(input: unknown): { digits: string; normalized: string } {
  const digits = String(input ?? '').replace(/\D/g, '')
  if (!digits) {
    throw createError({ statusCode: 400, statusMessage: 'Informe o telefone.' })
  }

  if (digits.startsWith('55')) {
    if (digits.length !== 12 && digits.length !== 13) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Telefone incompleto. Use DDI+DDD+número (ex: 55 11 9xxxx xxxx).',
      })
    }
  } else if (digits.length < 10) {
    throw createError({ statusCode: 400, statusMessage: 'Telefone incompleto.' })
  }

  const normalized = normalizeWhatsappBr(digits)
  return { digits, normalized }
}

function erroColunaOrigemNaoConfigurada() {
  return createError({
    statusCode: 400,
    statusMessage:
      'Configure a coluna origem dos leads em Configurações antes de criar conversas.',
    data: { code: CODIGO_COLUNA_ORIGEM_LEADS_NAO_CONFIGURADA },
  })
}

async function resolverColunaOrigemEFunil(
  admin: SupabaseAdmin,
  workspaceId: number,
): Promise<{ colunaId: number; funilId: number }> {
  const { data: ws, error: wsErr } = await admin
    .from('workspace')
    .select('coluna_origem_leads')
    .eq('id', workspaceId)
    .is('deleted_at', null)
    .maybeSingle()

  if (wsErr) {
    throw createError({ statusCode: 500, statusMessage: wsErr.message })
  }

  const colunaId = toInt((ws as { coluna_origem_leads?: unknown } | null)?.coluna_origem_leads)
  if (colunaId == null) {
    throw erroColunaOrigemNaoConfigurada()
  }

  const { data: funil, error: funilErr } = await admin
    .from('funil_workspace')
    .select('id')
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (funilErr) {
    throw createError({ statusCode: 500, statusMessage: funilErr.message })
  }
  if (!funil?.id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Funil não encontrado para este workspace.',
    })
  }

  const funilId = typeof funil.id === 'number' ? funil.id : Number(funil.id)
  if (!Number.isFinite(funilId) || funilId < 1) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Funil não encontrado para este workspace.',
    })
  }

  const { data: coluna, error: colErr } = await admin
    .from('funil_workspace_colunas')
    .select('id')
    .eq('id', colunaId)
    .eq('funil_id', funilId)
    .is('deleted_at', null)
    .maybeSingle()

  if (colErr) {
    throw createError({ statusCode: 500, statusMessage: colErr.message })
  }
  if (!coluna) {
    throw erroColunaOrigemNaoConfigurada()
  }

  return { colunaId, funilId }
}

/**
 * POST /api/conversas/ensure
 * Body: `{ id_canal, telefone }`
 *
 * Procura conversa por (id_canal + phone normalizado). Se não existir, cria com
 * `coluna_id` / `funil_id` a partir de `workspace.coluna_origem_leads`.
 */
export default defineEventHandler(async (event): Promise<Conversa> => {
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

  const body = (await readBody(event).catch(() => null)) as Body | null
  const canalId = toInt(body?.id_canal)
  if (!canalId) {
    throw createError({ statusCode: 400, statusMessage: 'id_canal inválido.' })
  }

  const allowed = await checkChannel(event, canalId, userId)
  if (!allowed) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Canal não encontrado ou sem permissão.',
    })
  }

  const { normalized } = normalizeAndValidatePhone(body?.telefone)

  const admin = serverSupabaseServiceRole<any>(event)

  const { data: canalRow, error: canalErr } = await admin
    .from('canais')
    .select('workspace_id')
    .eq('id', canalId)
    .is('deleted_at', null)
    .maybeSingle()

  if (canalErr) {
    throw createError({ statusCode: 500, statusMessage: canalErr.message })
  }

  const workspaceId = toInt((canalRow as { workspace_id?: unknown } | null)?.workspace_id)
  if (workspaceId == null) {
    throw createError({ statusCode: 400, statusMessage: 'Canal sem workspace vinculado.' })
  }

  const { data: existing, error: selErr } = await admin
    .from('conversas')
    .select(CONVERSA_SELECT)
    .eq('id_canal', canalId)
    .eq('phone', normalized)
    .is('deleted_at', null)
    .maybeSingle()

  if (selErr) {
    throw createError({ statusCode: 500, statusMessage: selErr.message })
  }

  if (existing) return existing as Conversa

  const { colunaId, funilId } = await resolverColunaOrigemEFunil(admin, workspaceId)

  const key = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`

  const nowIso = new Date().toISOString()

  const row = {
    key,
    id_canal: canalId,
    workspace_id: workspaceId,
    phone: normalized,
    lid: null,
    name: null,
    photo: null,
    message: null,
    messatype: null,
    connect_phone: null,
    from_me: null,
    media_url: null,
    conversa_aberta: true,
    is_group: false,
    nao_lidas: 0,
    ia_ligada: true,
    coluna_id: colunaId,
    funil_id: funilId,
    created_at: nowIso,
    updated_at: nowIso,
  }

  const { data: inserted, error: insErr } = await admin
    .from('conversas')
    .insert(row)
    .select(CONVERSA_SELECT)
    .single()

  if (insErr) {
    throw createError({ statusCode: 500, statusMessage: insErr.message })
  }

  return inserted as Conversa
})
