import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import type { KanbanCriarContatoResponse } from '#shared/types/kanban'
import {
  normalizeTelefoneBrParaEnvio,
  telefoneContatoNormalizadoValido,
} from '#shared/utils/normalizeWhatsappBr'
import { assertMethod, createError, readBody } from 'h3'
import { checkChannel } from '../../utils/checkChannel'
import { checkWorkspace } from '../../utils/checkWorkspace'
import { getAuthUserId } from '../../utils/getAuthUserId'

type Body = {
  workspace_id?: unknown
  nome?: unknown
  telefone?: unknown
  coluna_id?: unknown
  id_canal?: unknown
}

type SupabaseAdmin = ReturnType<typeof serverSupabaseServiceRole<any>>

function toInt(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === '') return null
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return null
  return n
}

function trimOrNull(raw: unknown): string | null {
  const t = String(raw ?? '').trim()
  return t.length > 0 ? t : null
}

function normalizePhoneInput(input: unknown): string {
  const normalized = normalizeTelefoneBrParaEnvio(input)
  if (!normalized) {
    throw createError({ statusCode: 400, statusMessage: 'Informe o telefone.' })
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

async function resolverCanalId(
  event: Parameters<typeof checkChannel>[0],
  userId: string,
  rawCanalId: unknown,
): Promise<number> {
  const informado = toInt(rawCanalId)
  if (informado == null) {
    throw createError({ statusCode: 400, statusMessage: 'id_canal inválido.' })
  }

  const ok = await checkChannel(event, informado, userId)
  if (!ok) {
    throw createError({ statusCode: 403, statusMessage: 'Canal inválido ou sem permissão.' })
  }

  return informado
}

async function validarColunaDoFunil(
  admin: SupabaseAdmin,
  workspaceId: number,
  colunaId: number,
): Promise<number> {
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

  return funilId
}

/**
 * POST /api/kanban/contato
 * Body: `{ workspace_id, nome, telefone, coluna_id, id_canal }`
 *
 * Cria ou atualiza linha em `conversas` (por `id_canal` + `phone`) e posiciona via `coluna_id` / `funil_id`.
 */
export default defineEventHandler(async (event): Promise<KanbanCriarContatoResponse> => {
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

  const workspaceId = toInt(body.workspace_id)
  if (!workspaceId) {
    throw createError({ statusCode: 400, statusMessage: 'workspace_id inválido.' })
  }

  const nome = trimOrNull(body.nome)
  if (!nome) {
    throw createError({ statusCode: 400, statusMessage: 'Informe o nome.' })
  }

  const colunaId = toInt(body.coluna_id)
  if (!colunaId) {
    throw createError({ statusCode: 400, statusMessage: 'coluna_id inválido.' })
  }

  const phone = normalizePhoneInput(body.telefone)

  await checkWorkspace(event, workspaceId, userId)

  const admin = serverSupabaseServiceRole<any>(event)

  const funilId = await validarColunaDoFunil(admin, workspaceId, colunaId)

  const idCanal = await resolverCanalId(event, userId, body.id_canal)

  const { data: existente, error: selErr } = await admin
    .from('conversas')
    .select('key')
    .eq('workspace_id', workspaceId)
    .eq('id_canal', idCanal)
    .eq('phone', phone)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (selErr) {
    throw createError({ statusCode: 500, statusMessage: selErr.message })
  }

  const nowIso = new Date().toISOString()
  const conversaKey =
    typeof existente?.key === 'string' && existente.key.trim()
      ? existente.key.trim()
      : globalThis.crypto?.randomUUID
        ? globalThis.crypto.randomUUID()
        : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`

  const row: Record<string, unknown> = {
    key: conversaKey,
    workspace_id: workspaceId,
    id_canal: idCanal,
    phone,
    name: nome,
    is_group: false,
    conversa_aberta: true,
    ia_ligada: true,
    nao_lidas: 0,
    coluna_id: colunaId,
    funil_id: funilId,
    updated_at: nowIso,
  }

  if (!existente) {
    row.created_at = nowIso
  }

  const { error: upsErr } = await admin.from('conversas').upsert(row, { onConflict: 'key' })
  if (upsErr) {
    throw createError({ statusCode: 500, statusMessage: upsErr.message })
  }

  return {
    ok: true,
    conversa_key: conversaKey,
    coluna_id: colunaId,
  }
})
