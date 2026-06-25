import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import type { Contato, ContatoAtualizarResponse } from '#shared/types/contato'
import { normalizeTelefoneBrParaEnvio, telefoneContatoNormalizadoValido } from '#shared/utils/normalizeWhatsappBr'
import { checkChannel } from '../../utils/checkChannel'
import { checkWorkspace } from '../../utils/checkWorkspace'
import { getAuthUserId } from '../../utils/getAuthUserId'

import { mapViewRowToContato } from '../../utils/viewConversasDetalhes'

const SELECT =
  'key, name, created_at, updated_at, id_canal, phone, lid, connect_phone, photo, workspace_id, latitude, longitude, conversa_aberta, is_group, name_group, ia_ligada, nao_lidas'

const VIEW = 'view_conversas_com_detalhes_campos'

const VIEW_SELECT = `${SELECT}, campos_personalizados, status_funil, deleted_at`

type Body = {
  workspace_id?: unknown
  key?: unknown
  patch?: unknown
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

function boolFromUnknown(v: unknown): boolean | undefined {
  if (v === undefined) return undefined
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v !== 0
  const s = String(v).trim().toLowerCase()
  if (['0', 'n', 'nao', 'não', 'false', 'f', 'off', 'fechada', 'fechado'].includes(s)) return false
  if (['1', 's', 'sim', 'true', 't', 'on', 'aberta', 'aberto'].includes(s)) return true
  return undefined
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

async function validarCanalNoWorkspace(
  event: Parameters<typeof checkChannel>[0],
  admin: ReturnType<typeof serverSupabaseServiceRole<any>>,
  workspaceId: number,
  canalId: number,
  userId: string,
) {
  const { data: canal, error } = await admin
    .from('canais')
    .select('id, workspace_id')
    .eq('id', canalId)
    .is('deleted_at', null)
    .is('deleted_by', null)
    .maybeSingle()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const wsRaw = (canal as { workspace_id?: unknown } | null)?.workspace_id
  const wsId = typeof wsRaw === 'number' ? wsRaw : wsRaw != null ? Number(wsRaw) : NaN
  if (!canal || !Number.isFinite(wsId) || wsId !== workspaceId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Canal inválido ou não pertence a este workspace.',
    })
  }

  const allowed = await checkChannel(event, canalId, userId)
  if (!allowed) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Sem permissão para usar este canal.',
    })
  }
}

/**
 * PATCH /api/contatos/atualizar
 * Body: `{ workspace_id, key, patch }` — atualiza campos da conversa/contato.
 */
export default defineEventHandler(async (event): Promise<ContatoAtualizarResponse> => {
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
    throw createError({ statusCode: 400, statusMessage: 'Informe key do contato.' })
  }

  const rawPatch = body.patch
  if (!rawPatch || typeof rawPatch !== 'object' || Array.isArray(rawPatch)) {
    throw createError({ statusCode: 400, statusMessage: 'Envie um objeto `patch` com os campos a alterar.' })
  }

  const p = rawPatch as Record<string, unknown>
  const keys = Object.keys(p)
  const allowed = new Set([
    'name',
    'phone',
    'photo',
    'conversa_aberta',
    'is_group',
    'name_group',
    'ia_ligada',
    'id_canal',
  ])

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
    .select('key, id_canal')
    .eq('key', key)
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .maybeSingle()

  if (exErr) {
    throw createError({ statusCode: 500, statusMessage: exErr.message })
  }
  if (!existente) {
    throw createError({ statusCode: 404, statusMessage: 'Contato não encontrado neste workspace.' })
  }

  const update: Record<string, unknown> = {}

  if (p.name !== undefined) update.name = strOrNull(p.name)
  if (p.photo !== undefined) update.photo = strOrNull(p.photo)

  if (p.phone !== undefined) {
    update.phone = normalizePhoneInput(p.phone)
  }

  if (p.conversa_aberta !== undefined) {
    const b = boolFromUnknown(p.conversa_aberta)
    if (b === undefined) {
      throw createError({ statusCode: 400, statusMessage: 'conversa_aberta inválido.' })
    }
    update.conversa_aberta = b
  }

  if (p.is_group !== undefined) {
    const b = boolFromUnknown(p.is_group)
    if (b === undefined) {
      throw createError({ statusCode: 400, statusMessage: 'is_group inválido.' })
    }
    update.is_group = b
    if (!b) update.name_group = null
  }

  if (p.name_group !== undefined) {
    update.name_group = strOrNull(p.name_group)
  }

  if (p.ia_ligada !== undefined) {
    const b = boolFromUnknown(p.ia_ligada)
    if (b === undefined) {
      throw createError({ statusCode: 400, statusMessage: 'ia_ligada inválido.' })
    }
    update.ia_ligada = b
  }

  if (p.id_canal !== undefined) {
    const canalId = intOrNull(p.id_canal)
    if (canalId == null) {
      throw createError({ statusCode: 400, statusMessage: 'id_canal inválido.' })
    }
    await validarCanalNoWorkspace(event, admin, workspaceId, canalId, userId)
    update.id_canal = canalId
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
    .select(SELECT)
    .single()

  if (updErr) {
    throw createError({ statusCode: 500, statusMessage: updErr.message })
  }

  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: 'Contato não encontrado.' })
  }

  const { data: viewRow, error: viewErr } = await admin
    .from(VIEW)
    .select(VIEW_SELECT)
    .eq('key', key)
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (viewErr) {
    throw createError({ statusCode: 500, statusMessage: viewErr.message })
  }

  if (viewRow && typeof viewRow === 'object') {
    return { data: mapViewRowToContato(viewRow as Record<string, unknown>) }
  }

  const base = mapViewRowToContato(updated as Record<string, unknown>)
  return { data: base }
})
