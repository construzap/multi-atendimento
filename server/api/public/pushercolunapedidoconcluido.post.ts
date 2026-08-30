import { assertMethod, createError, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { PusherKanbanAtualizacaoPayload } from '#shared/types/kanban'
import { normalizeEntregaStatus } from '#shared/utils/notificacaoIaProdutos'
import { requireN8nKanbanApiKey } from '../../utils/requireN8nKanbanApiKey'
import { triggerKanbanAtualizacao } from '../../utils/pusherServer'

type Body = {
  workspace_id?: unknown
  conversa_key?: unknown
  coluna_id?: unknown
  notificacao_id?: unknown
  /** Status em `notificacoes_ia.entrega_status` — espelhado no Pinia via Pusher (sem gravar no banco). */
  entrega_status?: unknown
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

/**
 * POST /api/public/pushercolunapedidoconcluido
 *
 * Sync leve N8N → Pusher → Pinia (sem escrever no banco).
 * Atualiza coluna do card e `notificacoes_ia[].entrega_status` no board.
 *
 * Auth: Authorization: Bearer <NUXT_N8N_KANBAN_API_KEY>  ou  x-api-key: <…>
 *
 * Body: `{ workspace_id, conversa_key, coluna_id, notificacao_id, entrega_status }`
 */
export default defineEventHandler(async (event) => {
  assertMethod(event, 'POST')
  requireN8nKanbanApiKey(event)

  const body = (await readBody(event).catch(() => null)) as Body | null
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Body JSON inválido.' })
  }

  const workspaceId = parsePositiveInt(body.workspace_id, 'workspace_id')
  const conversaKey = strOrNull(body.conversa_key)
  if (!conversaKey) {
    throw createError({ statusCode: 400, statusMessage: 'Informe conversa_key.' })
  }

  const colunaId = parsePositiveInt(body.coluna_id, 'coluna_id')
  const notificacaoId = parsePositiveInt(body.notificacao_id, 'notificacao_id')
  const entregaStatus = normalizeEntregaStatus(body.entrega_status)

  // Só leitura: precisa do id_canal para o canal Pusher (não grava nada).
  const admin = serverSupabaseServiceRole<any>(event)
  const { data: conversa, error: convErr } = await admin
    .from('conversas')
    .select('key, workspace_id, id_canal, name, phone, funil_id')
    .eq('key', conversaKey)
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .maybeSingle()

  if (convErr) throw createError({ statusCode: 500, statusMessage: convErr.message })
  if (!conversa) {
    throw createError({ statusCode: 404, statusMessage: 'Conversa não encontrada neste workspace.' })
  }

  const idCanal =
    typeof conversa.id_canal === 'number'
      ? conversa.id_canal
      : Number.parseInt(String(conversa.id_canal ?? ''), 10)
  if (!Number.isFinite(idCanal) || idCanal < 1) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Conversa sem id_canal válido — não é possível notificar o Pusher.',
    })
  }

  const funilId =
    typeof conversa.funil_id === 'number'
      ? conversa.funil_id
      : conversa.funil_id != null
        ? Number.parseInt(String(conversa.funil_id), 10)
        : null

  const payload: PusherKanbanAtualizacaoPayload = {
    workspace_id: workspaceId,
    conversa_key: conversaKey,
    id_canal: idCanal,
    coluna_id: colunaId,
    funil_id: Number.isFinite(funilId) && funilId != null && funilId >= 1 ? funilId : null,
    nome_contato: strOrNull(conversa.name) ?? strOrNull(conversa.phone),
    notificacao: null,
    notificacao_id: notificacaoId,
    notificacao_entrega_status: entregaStatus,
    motivo: 'pinia_sync',
  }

  await triggerKanbanAtualizacao(event, idCanal, payload)

  return {
    ok: true as const,
    workspace_id: workspaceId,
    conversa_key: conversaKey,
    coluna_id: colunaId,
    notificacao_id: notificacaoId,
    entrega_status: entregaStatus,
    id_canal: idCanal,
    motivo: 'pinia_sync' as const,
  }
})
