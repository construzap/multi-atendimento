import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, getQuery } from 'h3'
import type {
  ListarMensagensProntasResponse,
  MensagemProntaComPassos,
  MensagemProntaPasso,
  MensagemProntaSequenciaResumo,
  MensagemProntaTipo,
} from '#shared/types/mensagensProntas'
import { checkWorkspace } from '../../utils/checkWorkspace'
import { getAuthUserId } from '../../utils/getAuthUserId'
import { mapColunaDestinoId } from '../../utils/mensagensProntasColunaDestino'

/**
 * GET /api/mensagens_prontas?workspace_id=
 * Lista sequências do workspace com seus passos (ordem crescente).
 */
export default defineEventHandler(async (event): Promise<ListarMensagensProntasResponse> => {
  assertMethod(event, 'GET')

  const client = await serverSupabaseClient(event)
  const { data: authData, error: authError } = await client.auth.getUser()
  if (authError || !authData.user) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const userId = getAuthUserId(authData.user)
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const q = getQuery(event)
  const rawWs = q.workspace_id
  if (rawWs == null || String(rawWs).trim() === '') {
    throw createError({ statusCode: 400, statusMessage: 'Informe workspace_id na query.' })
  }
  const workspaceId = Number.parseInt(String(rawWs).trim(), 10)
  if (!Number.isFinite(workspaceId) || !Number.isInteger(workspaceId) || workspaceId < 1) {
    throw createError({ statusCode: 400, statusMessage: 'workspace_id inválido.' })
  }

  await checkWorkspace(event, workspaceId, userId)

  const rawSequenciaId = q.sequencia_id
  const sequenciaIdFilter =
    rawSequenciaId != null && String(rawSequenciaId).trim() !== ''
      ? String(rawSequenciaId).trim()
      : null

  const admin = serverSupabaseServiceRole<any>(event)

  let seqQuery = admin
    .from('mensagens_prontas_sequencias')
    .select('id, nome, workspace_id, user_id, created_at, coluna_destino_id')
    .eq('workspace_id', workspaceId)

  if (sequenciaIdFilter) {
    seqQuery = seqQuery.eq('id', sequenciaIdFilter)
  }

  const { data: sequencias, error: seqErr } = await seqQuery.order('created_at', {
    ascending: false,
  })

  if (seqErr) {
    throw createError({ statusCode: 500, statusMessage: seqErr.message })
  }

  const seqRows = sequencias ?? []
  if (seqRows.length === 0) {
    return { ok: true, items: [] }
  }

  const ids = seqRows.map((r: { id: string }) => String(r.id))

  const { data: passosRows, error: passosErr } = await admin
    .from('mensagens_prontas_passos')
    .select('id, sequencia_id, ordem, tipo, conteudo, delay_segundos, created_at')
    .in('sequencia_id', ids)
    .order('ordem', { ascending: true })

  if (passosErr) {
    throw createError({ statusCode: 500, statusMessage: passosErr.message })
  }

  const passosPorSeq = new Map<string, MensagemProntaPasso[]>()
  for (const row of passosRows ?? []) {
    const sid = String(row.sequencia_id)
    const passo: MensagemProntaPasso = {
      id: String(row.id),
      sequencia_id: sid,
      ordem: Number(row.ordem),
      tipo: String(row.tipo) as MensagemProntaTipo,
      conteudo: String(row.conteudo ?? ''),
      delay_segundos: Number(row.delay_segundos ?? 0),
      created_at: String(row.created_at ?? new Date().toISOString()),
    }
    const list = passosPorSeq.get(sid) ?? []
    list.push(passo)
    passosPorSeq.set(sid, list)
  }

  const items: MensagemProntaComPassos[] = seqRows.map((row: Record<string, unknown>) => {
    const sequencia: MensagemProntaSequenciaResumo = {
      id: String(row.id),
      nome: String(row.nome ?? ''),
      workspace_id:
        typeof row.workspace_id === 'number' ? row.workspace_id : Number(row.workspace_id),
      user_id: String(row.user_id ?? ''),
      created_at: String(row.created_at ?? new Date().toISOString()),
      coluna_destino_id: mapColunaDestinoId(row.coluna_destino_id),
    }
    return {
      sequencia,
      passos: passosPorSeq.get(sequencia.id) ?? [],
    }
  })

  return { ok: true, items }
})
