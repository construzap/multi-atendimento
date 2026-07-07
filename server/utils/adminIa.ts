import { serverSupabaseServiceRole } from '#supabase/server'
import { createError } from 'h3'
import type { H3Event } from 'h3'
import type { AdminCanalIa } from '#shared/types/adminIa'

export function mapCanalIaRow(r: Record<string, unknown>): AdminCanalIa {
  const id = typeof r.id === 'number' ? r.id : Number(r.id)
  const provedor = r.provedor == null ? null : Number(r.provedor)

  return {
    id: Number.isFinite(id) ? id : 0,
    nome: r.nome == null ? null : String(r.nome),
    descricao: r.descricao == null ? null : String(r.descricao),
    provedor: provedor != null && Number.isFinite(provedor) ? provedor : null,
    tem_inteligencia_artificial: Boolean(r.tem_inteligencia_artificial),
    created_at: String(r.created_at ?? ''),
  }
}

/** Garante que o canal pertence ao workspace e retorna os dados atuais. */
export async function fetchCanalIaDoWorkspace(
  event: H3Event,
  canalId: number,
  workspaceId: number,
): Promise<AdminCanalIa> {
  const admin = serverSupabaseServiceRole<any>(event)

  const { data, error } = await admin
    .from('canais')
    .select('id, nome, descricao, provedor, tem_inteligencia_artificial, created_at')
    .eq('id', canalId)
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .is('deleted_by', null)
    .maybeSingle()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  if (!data) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Canal não encontrado neste workspace.',
    })
  }

  return mapCanalIaRow(data as Record<string, unknown>)
}

/** Credenciais da instância Uazapi vinculada ao canal. */
export async function fetchCanalCredenciaisInstancia(
  event: H3Event,
  canalId: number,
  workspaceId: number,
): Promise<{ token: string; servidor: string }> {
  const admin = serverSupabaseServiceRole<any>(event)

  const { data, error } = await admin
    .from('canais')
    .select('token, servidor')
    .eq('id', canalId)
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .is('deleted_by', null)
    .maybeSingle()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  if (!data) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Canal não encontrado neste workspace.',
    })
  }

  const token = typeof data.token === 'string' ? data.token.trim() : ''
  const servidor = typeof data.servidor === 'string' ? data.servidor.trim() : ''

  if (!token || !servidor) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Canal não possui token/servidor configurados.',
    })
  }

  return { token, servidor }
}

/** Garante que o canal pertence ao workspace e não foi removido. */
export async function assertCanalDoWorkspace(
  event: H3Event,
  canalId: number,
  workspaceId: number,
): Promise<void> {
  await fetchCanalIaDoWorkspace(event, canalId, workspaceId)
}

export function parseCanalId(raw: unknown, label = 'id'): number {
  const n =
    typeof raw === 'number' && Number.isInteger(raw)
      ? raw
      : Number.parseInt(String(raw ?? '').trim(), 10)

  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw createError({ statusCode: 400, statusMessage: `${label} inválido.` })
  }
  return n
}

export function parseBooleanObrigatorio(raw: unknown, label: string): boolean {
  if (typeof raw === 'boolean') return raw
  throw createError({ statusCode: 400, statusMessage: `${label} deve ser true ou false.` })
}
