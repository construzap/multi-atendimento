import { assertMethod, createError, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import type {
  KanbanNotificacaoIa,
  KanbanNotificacaoTotalOrcamento,
  PusherKanbanAtualizacaoPayload,
} from '#shared/types/kanban'
import {
  normalizeEntregaStatus,
  normalizeProdutosRaw,
  normalizeTotalOrcamento,
} from '#shared/utils/notificacaoIaProdutos'
import { requireN8nKanbanApiKey } from '../../utils/requireN8nKanbanApiKey'
import { triggerKanbanAtualizacao } from '../../utils/pusherServer'

/** Campos opcionais que o N8N pode enviar para espelhar no Pinia (só os presentes são aplicados). */
const PATCH_KEYS = [
  'created_at',
  'endereco',
  'entrega_ou_retirada',
  'entrega_status',
  'forma_pagamento',
  'id_cobranca',
  'latitude',
  'longitude',
  'observacoes',
  'pagamento_realizado',
  'produtos',
  'tipo_solicitacao',
  'token_entrega',
  'total_orcamento',
  'updated_at',
] as const

type PatchKey = (typeof PATCH_KEYS)[number]

type Body = Record<string, unknown>

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

function numOrNull(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function buildNotificacaoPatch(body: Body): Partial<KanbanNotificacaoIa> {
  const patch: Partial<KanbanNotificacaoIa> = {}

  for (const key of PATCH_KEYS) {
    if (!(key in body) || body[key] === undefined) continue

    const raw = body[key]
    switch (key) {
      case 'entrega_status':
        patch.entrega_status = normalizeEntregaStatus(raw)
        break
      case 'produtos':
        patch.produtos = normalizeProdutosRaw(raw)
        break
      case 'total_orcamento':
        patch.total_orcamento = normalizeTotalOrcamento(raw) as KanbanNotificacaoTotalOrcamento
        break
      case 'pagamento_realizado':
        patch.pagamento_realizado =
          raw === true || raw === 'true' || raw === 1 || raw === '1'
        break
      case 'latitude':
      case 'longitude':
        patch[key] = numOrNull(raw)
        break
      case 'id_cobranca':
      case 'token_entrega':
      case 'endereco':
      case 'entrega_ou_retirada':
      case 'forma_pagamento':
      case 'observacoes':
      case 'tipo_solicitacao':
      case 'created_at':
      case 'updated_at':
        patch[key] = strOrNull(raw)
        break
      default: {
        const _exhaustive: never = key
        void _exhaustive
      }
    }
  }

  return patch
}

/**
 * POST /api/public/pushercolunapedidoconcluido
 *
 * Sync leve N8N → Pusher → Pinia (não grava no banco).
 * Obrigatório: `notificacao_id` (ou `id`).
 * Opcionais: qualquer campo da notificação — só os enviados atualizam o Pinia;
 * se a notificação não estiver no board, o client ignora (não cria).
 *
 * Auth: Authorization: Bearer <NUXT_N8N_KANBAN_API_KEY>  ou  x-api-key: <…>
 */
export default defineEventHandler(async (event) => {
  assertMethod(event, 'POST')
  requireN8nKanbanApiKey(event)

  const body = (await readBody(event).catch(() => null)) as Body | null
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Body JSON inválido.' })
  }

  const notificacaoId = parsePositiveInt(
    body.notificacao_id ?? body.id,
    'notificacao_id',
  )
  const patch = buildNotificacaoPatch(body)
  if (Object.keys(patch).length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage:
        'Envie ao menos um campo para atualizar (ex.: entrega_status, pagamento_realizado, …).',
    })
  }

  const admin = serverSupabaseServiceRole<any>(event)
  const { data: notif, error: nErr } = await admin
    .from('notificacoes_ia')
    .select('id, workspace_id, canal_id, conversa_key')
    .eq('id', notificacaoId)
    .maybeSingle()

  if (nErr) throw createError({ statusCode: 500, statusMessage: nErr.message })
  if (!notif) {
    throw createError({ statusCode: 404, statusMessage: 'notificacao_id não encontrada.' })
  }

  const workspaceId = parsePositiveInt(notif.workspace_id, 'workspace_id')
  const idCanal = parsePositiveInt(notif.canal_id, 'canal_id')
  const conversaKey = strOrNull(notif.conversa_key)
  if (!conversaKey) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Notificação sem conversa_key — não é possível notificar o Pusher.',
    })
  }

  const payload: PusherKanbanAtualizacaoPayload = {
    workspace_id: workspaceId,
    conversa_key: conversaKey,
    id_canal: idCanal,
    coluna_id: null,
    funil_id: null,
    nome_contato: null,
    notificacao: null,
    notificacao_id: notificacaoId,
    notificacao_patch: patch,
    motivo: 'pinia_sync',
  }

  await triggerKanbanAtualizacao(event, idCanal, payload)

  return {
    ok: true as const,
    workspace_id: workspaceId,
    conversa_key: conversaKey,
    id_canal: idCanal,
    notificacao_id: notificacaoId,
    patch,
    motivo: 'pinia_sync' as const,
  }
})
