import { assertMethod, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { criarAdapterAsaas, interpretarWebhookAsaas } from '../../../../../utils/pagamentos/asaas/adapter'
import { loadCanalCredenciaisPagamento } from '../../../../../utils/pagamentos/loadCredenciais'
import { parseIdPositivo } from '../../../../../utils/lojaLogin'
import { triggerLojaPedidoPago } from '../../../../../utils/pusherServer'

/**
 * POST /api/public/loja/pagamentos/webhook/asaas
 * Confirma pagamento no Asaas (GET payment) e marca notificacoes_ia.
 */
export default defineEventHandler(async (event) => {
  assertMethod(event, 'POST')

  const body = await readBody(event).catch(() => null)
  const evento = interpretarWebhookAsaas(body)
  if (!evento?.cobrancaId) {
    return { ok: true, ignored: true }
  }

  const admin = serverSupabaseServiceRole<any>(event)
  const { data, error } = await admin
    .from('notificacoes_ia')
    .select('id, canal_id, workspace_id, id_cobranca, pagamento_realizado')
    .eq('id_cobranca', evento.cobrancaId)
    .maybeSingle()

  let rec = (!error && data ? data : null) as Record<string, unknown> | null

  if (!rec) {
    const pedidoRef = parseIdPositivo(evento.referenciaExterna)
    if (pedidoRef != null) {
      const { data: byRef } = await admin
        .from('notificacoes_ia')
        .select('id, canal_id, workspace_id, id_cobranca, pagamento_realizado')
        .eq('id', pedidoRef)
        .maybeSingle()
      rec = (byRef ?? null) as Record<string, unknown> | null
    }
  }

  if (!rec) {
    return { ok: true, ignored: true }
  }

  const pedidoId = parseIdPositivo(rec.id)
  const canalId = parseIdPositivo(rec.canal_id)
  const workspaceId = parseIdPositivo(rec.workspace_id)
  if (pedidoId == null || canalId == null || workspaceId == null) {
    return { ok: true, ignored: true }
  }

  if (rec.pagamento_realizado === true) {
    await triggerLojaPedidoPago(event, pedidoId)
    return { ok: true, already: true }
  }

  try {
    const apiKey = await loadCanalCredenciaisPagamento(event, { canalId, workspaceId })
    const cobranca = await criarAdapterAsaas(apiKey).consultarCobranca(evento.cobrancaId)
    if (cobranca.status !== 'pago') {
      return { ok: true, pending: true }
    }
  } catch {
    return { ok: true, verify_failed: true }
  }

  await admin
    .from('notificacoes_ia')
    .update({
      pagamento_realizado: true,
      id_cobranca: evento.cobrancaId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', pedidoId)

  await triggerLojaPedidoPago(event, pedidoId)
  return { ok: true }
})
