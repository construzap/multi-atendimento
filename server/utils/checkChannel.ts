import { serverSupabaseServiceRole } from '#supabase/server'
import { createError } from 'h3'
import type { H3Event } from 'h3'

/**
 * Verifica se o usuário tem acesso ao canal:
 * 1. Canal existe em `canais` (não deletado) — obtém `workspace_id` (e `user_id` do criador).
 * 2. Existe linha em `atendentes` com esse `workspace_id` e `atendente_user_id` = usuário logado.
 *
 * @returns `true` se autorizado; `false` se canal inexistente/removido ou sem vínculo em `atendentes`.
 */
export async function checkChannel(
  event: H3Event,
  canalId: number,
  userId: string,
): Promise<boolean> {
  const admin = serverSupabaseServiceRole<any>(event)

  const { data: canal, error: canalErr } = await admin
    .from('canais')
    .select('id, workspace_id, user_id')
    .eq('id', canalId)
    .is('deleted_at', null)
    .is('deleted_by', null)
    .maybeSingle()

  if (canalErr) {
    throw createError({
      statusCode: 500,
      statusMessage: canalErr.message,
    })
  }

  if (!canal) {
    return false
  }

  const wsRaw = (canal as { workspace_id?: unknown }).workspace_id
  const workspaceId =
    typeof wsRaw === 'number' ? wsRaw : wsRaw != null ? Number(wsRaw) : NaN
  if (!Number.isFinite(workspaceId) || !Number.isInteger(workspaceId) || workspaceId < 1) {
    return false
  }

  const { data: atend, error: atendErr } = await admin
    .from('atendentes')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('atendente_user_id', userId)
    .maybeSingle()

  if (atendErr) {
    throw createError({
      statusCode: 500,
      statusMessage: atendErr.message,
    })
  }

  return atend != null
}

/**
 * Versão batch: verifica acesso a **todos** os canais informados (mesma regra que `checkChannel`).
 */
export async function checkChannels(
  event: H3Event,
  canalIds: number[],
  userId: string,
): Promise<boolean> {
  const ids = Array.from(
    new Set((canalIds ?? []).filter((x) => Number.isFinite(x) && Number.isInteger(x) && x > 0)),
  )
  if (!ids.length) return false

  const admin = serverSupabaseServiceRole<any>(event)

  const { data: canaisRows, error: canalErr } = await admin
    .from('canais')
    .select('id, workspace_id')
    .in('id', ids)
    .is('deleted_at', null)
    .is('deleted_by', null)

  if (canalErr) {
    throw createError({
      statusCode: 500,
      statusMessage: canalErr.message,
    })
  }

  const rows = canaisRows ?? []
  if (rows.length !== ids.length) {
    return false
  }

  const workspaceIds = [
    ...new Set(
      rows
        .map((r: { workspace_id?: unknown }) => {
          const w = r.workspace_id
          return typeof w === 'number' ? w : w != null ? Number(w) : NaN
        })
        .filter((n: number) => Number.isFinite(n) && Number.isInteger(n) && n > 0),
    ),
  ]

  if (!workspaceIds.length) {
    return false
  }

  const { data: atendRows, error: atendErr } = await admin
    .from('atendentes')
    .select('workspace_id')
    .eq('atendente_user_id', userId)
    .in('workspace_id', workspaceIds)

  if (atendErr) {
    throw createError({
      statusCode: 500,
      statusMessage: atendErr.message,
    })
  }

  const allowedWs = new Set(
    (atendRows ?? []).map((r: { workspace_id?: unknown }) => {
      const w = r.workspace_id
      return typeof w === 'number' ? w : w != null ? Number(w) : NaN
    }).filter((n: number) => Number.isFinite(n)),
  )

  return rows.every((r: { workspace_id?: unknown }) => {
    const w = r.workspace_id
    const wid = typeof w === 'number' ? w : w != null ? Number(w) : NaN
    return allowedWs.has(wid)
  })
}
