import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import type { KanbanConversaAtualizarResponse } from '#shared/types/kanban'
import { normalizeTelefoneBrParaEnvio, telefoneContatoNormalizadoValido } from '#shared/utils/normalizeWhatsappBr'
import { checkChannel } from '../../utils/checkChannel'
import { checkWorkspace } from '../../utils/checkWorkspace'
import { getAuthUserId } from '../../utils/getAuthUserId'

const SELECT =
  'key, name, updated_at, id_canal, phone, lid, photo, conversa_aberta, is_group, name_group, ia_ligada'

type Body = {
  workspace_id?: unknown
  conversa_key?: unknown
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
 * PATCH /api/kanban/conversa
 * Body: `{ workspace_id, conversa_key, patch }` — atualiza dados da conversa exibidos no card do kanban.
 */
export default defineEventHandler(async (event): Promise<KanbanConversaAtualizarResponse> => {
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
  const conversaKey = String(body.conversa_key ?? '').trim()
  if (!conversaKey) {
    throw createError({ statusCode: 400, statusMessage: 'Informe conversa_key.' })
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
    .select('key')
    .eq('key', conversaKey)
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

  if (p.name !== undefined) update.name = strOrNull(p.name)
  if (p.photo !== undefined) update.photo = strOrNull(p.photo)

  if (p.phone !== undefined) {
    // Telefone editado manualmente: LID antigo deixa de ser confiável para envio.
    update.phone = normalizePhoneInput(p.phone)
    update.lid = null
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
    .eq('key', conversaKey)
    .eq('workspace_id', workspaceId)
    .select(SELECT)
    .single()

  if (updErr) {
    throw createError({ statusCode: 500, statusMessage: updErr.message })
  }

  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: 'Conversa não encontrada.' })
  }

  const row = updated as Record<string, unknown>
  const idCanalRaw = row.id_canal
  const id_canal =
    idCanalRaw != null && Number.isFinite(Number(idCanalRaw)) && Number(idCanalRaw) >= 1
      ? Math.trunc(Number(idCanalRaw))
      : null

  const conversa_aberta = boolFromUnknown(row.conversa_aberta)
  const is_group = boolFromUnknown(row.is_group)
  const ia_ligada = boolFromUnknown(row.ia_ligada)

  return {
    conversa_key: String(row.key ?? conversaKey),
    name: strOrNull(row.name),
    phone: strOrNull(row.phone),
    lid: strOrNull(row.lid),
    photo: strOrNull(row.photo),
    updated_at: strOrNull(row.updated_at),
    id_canal,
    conversa_aberta: conversa_aberta ?? null,
    is_group: is_group ?? null,
    name_group: strOrNull(row.name_group),
    ia_ligada: ia_ligada ?? null,
  }
})
