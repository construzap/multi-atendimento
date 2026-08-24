import type { PerfilConsolidadoRow } from '#shared/types/adminGerenciarAssinaturas'
import { createError } from 'h3'
import type { H3Event } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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

export function mapPerfilConsolidadoRow(r: Record<string, unknown>): PerfilConsolidadoRow {
  const customerRaw = r.customer
  let customer: string | null = null
  if (customerRaw != null && customerRaw !== '') {
    customer =
      typeof customerRaw === 'string' ? customerRaw : JSON.stringify(customerRaw)
  }

  return {
    id: String(r.id ?? ''),
    user_id: String(r.user_id ?? ''),
    email: r.email == null || String(r.email).trim() === '' ? null : String(r.email),
    full_name:
      r.full_name == null || String(r.full_name).trim() === ''
        ? null
        : String(r.full_name),
    created_at:
      r.created_at == null || String(r.created_at).trim() === ''
        ? null
        : String(r.created_at),
    data_expiracao:
      r.data_expiracao == null || String(r.data_expiracao).trim() === ''
        ? null
        : String(r.data_expiracao),
    whatsapp:
      r.whatsapp == null || String(r.whatsapp).trim() === ''
        ? null
        : String(r.whatsapp),
    customer,
    subscription_id:
      r.subscription_id == null || String(r.subscription_id).trim() === ''
        ? null
        : String(r.subscription_id),
    canais: parseIntOrNull(r.canais),
    limite_ias: parseIntOrNull(r.limite_ias),
  }
}

export async function fetchPerfilConsolidadoPorUserId(
  event: H3Event,
  userId: string,
): Promise<PerfilConsolidadoRow | null> {
  const admin = serverSupabaseServiceRole<any>(event)

  const { data, error } = await admin
    .from('vw_perfil_consolidado')
    .select(
      'id, user_id, email, full_name, created_at, data_expiracao, whatsapp, customer, subscription_id, canais, limite_ias',
    )
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  if (!data) return null
  return mapPerfilConsolidadoRow(data as Record<string, unknown>)
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
