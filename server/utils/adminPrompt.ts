import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError } from 'h3'
import type { H3Event } from 'h3'
import { checkAdmin } from './checkAdmin'
import { getAuthUserId } from './getAuthUserId'

/** Autentica o usuário e garante perfil `ADMIN`. Retorna `user_id`. */
export async function requireAdminUser(event: H3Event): Promise<string> {
  const client = await serverSupabaseClient(event)
  const { data: authData, error: authError } = await client.auth.getUser()

  if (authError || !authData.user) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const userId = getAuthUserId(authData.user)
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  await checkAdmin(event, userId)
  return userId
}

export function parseWorkspaceId(raw: unknown, label = 'workspace_id'): number {
  const n =
    typeof raw === 'number' && Number.isInteger(raw)
      ? raw
      : Number.parseInt(String(raw ?? '').trim(), 10)

  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw createError({ statusCode: 400, statusMessage: `${label} inválido.` })
  }
  return n
}

export function parsePromptId(raw: unknown, label = 'id'): number {
  return parseWorkspaceId(raw, label)
}

export function parseTextoObrigatorio(raw: unknown, label: string, maxLen?: number): string {
  const s = String(raw ?? '').trim()
  if (!s) {
    throw createError({ statusCode: 400, statusMessage: `${label} é obrigatório.` })
  }
  if (maxLen != null && s.length > maxLen) {
    throw createError({ statusCode: 400, statusMessage: `${label} excede ${maxLen} caracteres.` })
  }
  return s
}

/** Garante que o workspace existe e não foi removido (soft delete). */
export async function assertAdminWorkspaceAtivo(event: H3Event, workspaceId: number): Promise<void> {
  const admin = serverSupabaseServiceRole<any>(event)

  const { data, error } = await admin
    .from('workspace')
    .select('id')
    .eq('id', workspaceId)
    .is('deleted_at', null)
    .is('deleted_by', null)
    .maybeSingle()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  if (!data) {
    throw createError({ statusCode: 404, statusMessage: 'Workspace não encontrado ou foi removido.' })
  }
}

/** Garante que o prompt pertence ao workspace informado. */
export async function assertPromptDoWorkspace(
  event: H3Event,
  promptId: number,
  workspaceId: number,
): Promise<void> {
  const admin = serverSupabaseServiceRole<any>(event)

  const { data, error } = await admin
    .from('prompt_workspace')
    .select('id')
    .eq('id', promptId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  if (!data) {
    throw createError({ statusCode: 404, statusMessage: 'Prompt não encontrado neste workspace.' })
  }
}

/** Lê `workspace.prompt_principal` para o workspace informado. */
export async function getPromptPrincipalId(
  event: H3Event,
  workspaceId: number,
): Promise<number | null> {
  const admin = serverSupabaseServiceRole<any>(event)

  const { data, error } = await admin
    .from('workspace')
    .select('prompt_principal')
    .eq('id', workspaceId)
    .maybeSingle()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const raw = (data as { prompt_principal?: unknown } | null)?.prompt_principal
  if (raw == null) return null

  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10)
  return Number.isFinite(n) && n > 0 ? n : null
}
