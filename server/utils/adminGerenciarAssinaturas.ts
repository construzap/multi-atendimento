import type { PerfilConsolidadoRow } from '#shared/types/adminGerenciarAssinaturas'
import type { UserRole } from '#shared/types/profile'
import { createError } from 'h3'
import type { H3Event } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Campos da view usados na listagem/detalhe admin. */
const SELECT_PERFIL_CONSOLIDADO =
  'id, user_id, email, full_name, created_at, data_expiracao, whatsapp, customer, subscription_id, canais, limite_ias, limite_mensal_token, canais_criados, ias_atreladas, status_assinatura, total_tokens_usados, status_limite_tokens'

export function parseUserId(raw: unknown): string {
  const userId = String(raw ?? '').trim()
  if (!userId || !UUID_RE.test(userId)) {
    throw createError({ statusCode: 400, statusMessage: 'user_id inválido' })
  }
  return userId
}

function parseIntOrNull(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10)
  return Number.isFinite(n) && Number.isInteger(n) ? n : null
}

function parseIntOrZero(raw: unknown): number {
  const n = parseIntOrNull(raw)
  return n ?? 0
}

function parseNumberOrZero(raw: unknown): number {
  if (raw == null || raw === '') return 0
  const n = typeof raw === 'number' ? raw : Number(String(raw))
  return Number.isFinite(n) ? n : 0
}

function parseNumberOrNull(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  const n = typeof raw === 'number' ? raw : Number(String(raw))
  return Number.isFinite(n) ? n : null
}

function parseTextOrNull(raw: unknown): string | null {
  if (raw == null || String(raw).trim() === '') return null
  return String(raw)
}

function parseRoleRaw(raw: unknown): UserRole {
  return raw === 'ADMIN' ? 'ADMIN' : 'MEMBRO'
}

export function mapPerfilConsolidadoRow(
  r: Record<string, unknown>,
  role: UserRole = 'MEMBRO',
): PerfilConsolidadoRow {
  return {
    id: String(r.id ?? ''),
    user_id: String(r.user_id ?? ''),
    email: parseTextOrNull(r.email),
    full_name: parseTextOrNull(r.full_name),
    created_at: parseTextOrNull(r.created_at),
    data_expiracao: parseTextOrNull(r.data_expiracao),
    whatsapp: parseTextOrNull(r.whatsapp),
    customer: parseTextOrNull(r.customer),
    subscription_id: parseTextOrNull(r.subscription_id),
    canais: parseIntOrNull(r.canais),
    limite_ias: parseIntOrNull(r.limite_ias),
    limite_mensal_token: parseNumberOrNull(r.limite_mensal_token),
    role,
    canais_criados: parseIntOrZero(r.canais_criados),
    ias_atreladas: parseIntOrZero(r.ias_atreladas),
    status_assinatura: String(r.status_assinatura ?? ''),
    total_tokens_usados: parseNumberOrZero(r.total_tokens_usados),
    status_limite_tokens: String(r.status_limite_tokens ?? ''),
  }
}

async function fetchRolesPorUserIds(
  event: H3Event,
  userIds: string[],
): Promise<Map<string, UserRole>> {
  const map = new Map<string, UserRole>()
  if (!userIds.length) return map

  const admin = serverSupabaseServiceRole<any>(event)
  const { data, error } = await admin
    .from('profiles')
    .select('user_id, role')
    .in('user_id', userIds)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  for (const row of (data ?? []) as Array<{ user_id?: unknown; role?: unknown }>) {
    const id = String(row.user_id ?? '')
    if (!id) continue
    map.set(id, parseRoleRaw(row.role))
  }

  return map
}

export async function fetchTodosPerfisConsolidados(
  event: H3Event,
): Promise<PerfilConsolidadoRow[]> {
  const admin = serverSupabaseServiceRole<any>(event)

  const { data, error } = await admin
    .from('vw_perfil_consolidado')
    .select(SELECT_PERFIL_CONSOLIDADO)
    .order('full_name', { ascending: true })

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const rows = (data ?? []) as Record<string, unknown>[]
  const userIds = rows.map((r) => String(r.user_id ?? '')).filter(Boolean)
  const roles = await fetchRolesPorUserIds(event, userIds)

  return rows.map((r) => {
    const userId = String(r.user_id ?? '')
    return mapPerfilConsolidadoRow(r, roles.get(userId) ?? 'MEMBRO')
  })
}

export async function fetchPerfilConsolidadoPorUserId(
  event: H3Event,
  userId: string,
): Promise<PerfilConsolidadoRow | null> {
  const admin = serverSupabaseServiceRole<any>(event)

  const { data, error } = await admin
    .from('vw_perfil_consolidado')
    .select(SELECT_PERFIL_CONSOLIDADO)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  if (!data) return null

  const roles = await fetchRolesPorUserIds(event, [userId])
  return mapPerfilConsolidadoRow(
    data as Record<string, unknown>,
    roles.get(userId) ?? 'MEMBRO',
  )
}

export function parseEmail(raw: unknown): string {
  const email = String(raw ?? '').trim()
  if (!email) {
    throw createError({ statusCode: 400, statusMessage: 'email é obrigatório' })
  }
  return email
}

export function parseOptionalText(raw: unknown): string | null {
  if (raw == null) return null
  const value = String(raw).trim()
  return value === '' ? null : value
}

export function parseDataExpiracao(raw: unknown): string {
  const value = String(raw ?? '').trim()
  if (!value) {
    throw createError({ statusCode: 400, statusMessage: 'data_expiracao é obrigatória' })
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw createError({ statusCode: 400, statusMessage: 'data_expiracao inválida' })
  }

  return date.toISOString()
}

export function parseInteiroNaoNegativo(raw: unknown, campo: string): number {
  const n =
    typeof raw === 'number' && Number.isInteger(raw)
      ? raw
      : Number.parseInt(String(raw ?? '').trim(), 10)

  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
    throw createError({
      statusCode: 400,
      statusMessage: `${campo} deve ser um inteiro maior ou igual a zero`,
    })
  }

  return n
}

export function parseUserRole(raw: unknown): UserRole {
  const role = String(raw ?? '').trim().toUpperCase()
  if (role === 'ADMIN' || role === 'MEMBRO') return role
  throw createError({
    statusCode: 400,
    statusMessage: 'role deve ser ADMIN ou MEMBRO',
  })
}
