import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import type { Conversa, ConversaAtualizarResponse } from '#shared/types/conversa'
import type { MessageType } from '#shared/types/messageType'
import { normalizeTelefoneBrParaEnvio, telefoneContatoNormalizadoValido } from '#shared/utils/normalizeWhatsappBr'
import { checkWorkspace } from '../../utils/checkWorkspace'
import { getAuthUserId } from '../../utils/getAuthUserId'

const CONVERSA_SELECT =
  'key, message, messatype, name, created_at, updated_at, id_canal, phone, lid, connect_phone, photo, from_me, media_url, conversa_aberta, is_group, id_group, name_group, nao_lidas, funil_id, coluna_id, atendente_id'

type Body = {
  workspace_id?: unknown
  key?: unknown
  patch?: unknown
}

type ConversaRow = {
  key: string
  message: string | null
  messatype: string | null
  name: string | null
  created_at: string | null
  updated_at: string | null
  id_canal: number | null
  phone: string | null
  lid: string | null
  connect_phone: string | null
  photo: string | null
  from_me: boolean | null
  media_url: string | null
  conversa_aberta: boolean | null
  is_group: boolean | null
  id_group: string | null
  name_group: string | null
  nao_lidas: number | null
  funil_id: number | null
  coluna_id: number | null
  atendente_id: number | null
}

function parsePositiveInt(raw: unknown, label: string): number {
  const n =
    typeof raw === 'number' && Number.isInteger(raw)
      ? raw
      : Number.parseInt(String(raw ?? '').trim(), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw createError({ statusCode: 400, statusMessage: `${label} inválido.` })
  }
  return n
}

function strOrNull(v: unknown): string | null {
  if (v === undefined || v === null) return null
  const s = typeof v === 'string' ? v.trim() : String(v).trim()
  return s.length ? s : null
}

function intOrNull(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null
  const n = typeof v === 'number' ? Math.trunc(v) : Number.parseInt(String(v).trim(), 10)
  return Number.isFinite(n) && Number.isInteger(n) && n > 0 ? n : null
}

function normalizePhoneInput(input: unknown): string {
  const normalized = normalizeTelefoneBrParaEnvio(input)
  if (!normalized) {
    throw createError({ statusCode: 400, statusMessage: 'Telefone não pode ser vazio.' })
  }

  if (!telefoneContatoNormalizadoValido(normalized)) {
    const detalhe = normalized.startsWith('55')
      ? 'Use DDI+DDD+número (ex: 55 11 9xxxx xxxx).'
      : 'Informe um número válido.'
    throw createError({
      statusCode: 400,
      statusMessage: `Telefone incompleto (${normalized}). ${detalhe}`,
    })
  }

  return normalized
}

function mapRowToConversa(row: ConversaRow): Conversa {
  return {
    key: row.key,
    message: row.message,
    messatype: (row.messatype ?? null) as MessageType | null,
    name: row.name,
    created_at: row.created_at,
    updated_at: row.updated_at,
    id_canal: row.id_canal,
    phone: row.phone,
    lid: row.lid,
    connect_phone: row.connect_phone,
    photo: row.photo,
    from_me: row.from_me,
    media_url: row.media_url,
    conversa_aberta: row.conversa_aberta,
    is_group: row.is_group,
    id_group: row.id_group,
    name_group: row.name_group,
    nao_lidas: row.nao_lidas ?? 0,
    funil_id: row.funil_id,
    coluna_id: row.coluna_id,
    atendente_id: row.atendente_id,
  }
}

async function validarColunaNoWorkspace(
  admin: ReturnType<typeof serverSupabaseServiceRole<any>>,
  workspaceId: number,
  colunaId: number,
) {
  const { data: funil, error: funilErr } = await admin
    .from('funil_workspace')
    .select('id')
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (funilErr) {
    throw createError({ statusCode: 500, statusMessage: funilErr.message })
  }
  if (!funil?.id) {
    throw createError({ statusCode: 400, statusMessage: 'Funil não encontrado para este workspace.' })
  }

  const funilId = typeof funil.id === 'number' ? funil.id : Number(funil.id)

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
    throw createError({
      statusCode: 400,
      statusMessage: 'Coluna inválida ou não pertence ao funil deste workspace.',
    })
  }
}

/**
 * PATCH /api/conversas/atualizar
 * Body: `{ workspace_id, key, patch }` — atualiza `name`, `phone` (limpa `lid`) e `coluna_id`.
 * Não altera `funil_id`.
 */
export default defineEventHandler(async (event): Promise<ConversaAtualizarResponse> => {
  assertMethod(event, 'PATCH')

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
  const workspaceId = parsePositiveInt(body.workspace_id, 'workspace_id')
  const key = String(body.key ?? '').trim()
  if (!key) {
    throw createError({ statusCode: 400, statusMessage: 'Informe key da conversa.' })
  }

  const rawPatch = body.patch
  if (!rawPatch || typeof rawPatch !== 'object' || Array.isArray(rawPatch)) {
    throw createError({ statusCode: 400, statusMessage: 'Envie um objeto `patch` com os campos a alterar.' })
  }

  const p = rawPatch as Record<string, unknown>
  const keys = Object.keys(p)
  const allowed = new Set(['name', 'phone', 'coluna_id'])

  for (const k of keys) {
    if (!allowed.has(k)) {
      throw createError({ statusCode: 400, statusMessage: `Campo não permitido no patch: ${k}.` })
    }
  }

  if (keys.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'O patch não pode ser vazio.' })
  }

  await checkWorkspace(event, workspaceId, userId)

  const admin = serverSupabaseServiceRole<any>(event)

  const { data: existente, error: exErr } = await admin
    .from('conversas')
    .select('key')
    .eq('key', key)
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .maybeSingle()

  if (exErr) {
    throw createError({ statusCode: 500, statusMessage: exErr.message })
  }
  if (!existente) {
    throw createError({ statusCode: 404, statusMessage: 'Conversa não encontrada neste workspace.' })
  }

  const update: Record<string, unknown> = {}

  if (p.name !== undefined) {
    update.name = strOrNull(p.name)
  }

  if (p.phone !== undefined) {
    update.phone = normalizePhoneInput(p.phone)
    update.lid = null
  }

  if (p.coluna_id !== undefined) {
    const colunaId = intOrNull(p.coluna_id)
    if (colunaId == null) {
      update.coluna_id = null
    } else {
      await validarColunaNoWorkspace(admin, workspaceId, colunaId)
      update.coluna_id = colunaId
    }
  }

  if (Object.keys(update).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Nenhum campo válido para atualizar.' })
  }

  update.updated_at = new Date().toISOString()

  const { data: updated, error: updErr } = await admin
    .from('conversas')
    .update(update)
    .eq('key', key)
    .eq('workspace_id', workspaceId)
    .select(CONVERSA_SELECT)
    .single()

  if (updErr) {
    throw createError({ statusCode: 500, statusMessage: updErr.message })
  }

  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: 'Conversa não encontrada.' })
  }

  return { data: mapRowToConversa(updated as ConversaRow) }
})
