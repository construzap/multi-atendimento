import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import type { Anotacao, AnotacaoTipo } from '#shared/types/anotacao'
import { checkChannel } from '../../utils/checkChannel'
import { checkWorkspace } from '../../utils/checkWorkspace'
import { getAuthUserId } from '../../utils/getAuthUserId'

const SELECT =
  'id, conversa_key, workspace_id, canal_id, tipo_anotacao, anotacao_text, media_url, created_at, updated_at'

type Body = {
  workspace_id?: unknown
  canal_id?: unknown
  conversa_key?: unknown
  tipo_anotacao?: unknown
  anotacao_text?: unknown
  media_url?: unknown
}

const TIPOS: AnotacaoTipo[] = ['texto', 'audio', 'imagem', 'video', 'documento']

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

function parseTipo(raw: unknown): AnotacaoTipo {
  const s = String(raw ?? '').trim().toLowerCase()
  if ((TIPOS as string[]).includes(s)) return s as AnotacaoTipo
  throw createError({
    statusCode: 400,
    statusMessage: 'tipo_anotacao deve ser texto, audio, imagem, video ou documento.',
  })
}

function mapRow(row: Record<string, unknown>): Anotacao {
  const tipoRaw = String(row.tipo_anotacao ?? 'texto').trim().toLowerCase()
  const tipo = (TIPOS as string[]).includes(tipoRaw) ? (tipoRaw as AnotacaoTipo) : 'texto'
  return {
    id: typeof row.id === 'number' ? row.id : Number(row.id),
    conversa_key: String(row.conversa_key ?? ''),
    workspace_id: typeof row.workspace_id === 'number' ? row.workspace_id : Number(row.workspace_id),
    canal_id: typeof row.canal_id === 'number' ? row.canal_id : Number(row.canal_id),
    tipo_anotacao: tipo,
    anotacao_text: String(row.anotacao_text ?? ''),
    media_url: typeof row.media_url === 'string' && row.media_url.trim() ? row.media_url.trim() : null,
    created_at: typeof row.created_at === 'string' ? row.created_at : null,
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : null,
  }
}

/**
 * POST /api/anotacoes_conversas
 * Body: `{ workspace_id, canal_id, conversa_key, tipo_anotacao, anotacao_text, media_url? }`
 */
export default defineEventHandler(async (event): Promise<{ data: Anotacao }> => {
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
  const workspaceId = parsePositiveInt(body.workspace_id, 'workspace_id')
  const canalId = parsePositiveInt(body.canal_id, 'canal_id')
  const conversaKey = String(body.conversa_key ?? '').trim()
  if (!conversaKey) {
    throw createError({ statusCode: 400, statusMessage: 'Informe conversa_key.' })
  }

  const tipo = parseTipo(body.tipo_anotacao)
  const texto = String(body.anotacao_text ?? '').trim()
  const mediaUrlRaw = typeof body.media_url === 'string' ? body.media_url.trim() : ''
  const mediaUrl = mediaUrlRaw || null

  if (tipo === 'texto') {
    if (!texto) {
      throw createError({ statusCode: 400, statusMessage: 'Informe o texto da anotação.' })
    }
    if (mediaUrl) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Anotação de texto não deve ter media_url.',
      })
    }
  } else if (!mediaUrl) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Envie media_url para anotações com mídia (faça o upload antes).',
    })
  }

  await checkWorkspace(event, workspaceId, userId)
  const canalOk = await checkChannel(event, canalId, userId)
  if (!canalOk) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Canal não encontrado ou sem permissão.',
    })
  }

  const admin = serverSupabaseServiceRole<any>(event)

  const { data: conversa, error: convErr } = await admin
    .from('conversas')
    .select('key, workspace_id, id_canal')
    .eq('key', conversaKey)
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .maybeSingle()

  if (convErr) {
    throw createError({ statusCode: 500, statusMessage: convErr.message })
  }
  if (!conversa) {
    throw createError({ statusCode: 404, statusMessage: 'Conversa não encontrada neste workspace.' })
  }

  const conversaCanal =
    typeof (conversa as { id_canal?: unknown }).id_canal === 'number'
      ? (conversa as { id_canal: number }).id_canal
      : Number((conversa as { id_canal?: unknown }).id_canal)
  if (Number.isFinite(conversaCanal) && conversaCanal > 0 && conversaCanal !== canalId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'canal_id não corresponde à conversa.',
    })
  }

  const nowIso = new Date().toISOString()
  const anotacaoText = texto.length > 0 ? texto : ' '
  const { data: inserted, error: insErr } = await admin
    .from('anotacoes')
    .insert({
      conversa_key: conversaKey,
      workspace_id: workspaceId,
      canal_id: canalId,
      tipo_anotacao: tipo,
      anotacao_text: anotacaoText,
      media_url: mediaUrl,
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select(SELECT)
    .single()

  if (insErr) {
    throw createError({ statusCode: 500, statusMessage: insErr.message })
  }
  if (!inserted) {
    throw createError({ statusCode: 500, statusMessage: 'Falha ao criar anotação.' })
  }

  return { data: mapRow(inserted as Record<string, unknown>) }
})
