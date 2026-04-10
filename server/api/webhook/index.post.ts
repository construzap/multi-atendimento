import { serverSupabaseServiceRole } from '#supabase/server'
import type { UazapiWebhookPayload } from '#shared/types/webhook'
import { persistWebhookMensagem } from '../../utils/persistWebhookMensagem'
import { normalizarMensagem } from '../../utils/webhookNormalizer'

export default defineEventHandler(async (event) => {
  const body = await readBody<UazapiWebhookPayload>(event)

  // ── Filtra somente eventos de mensagem (demais serão ignorados por ora) ───
  if (body?.EventType !== 'messages') {
    return { ok: true, skipped: true, reason: 'event_ignored' }
  }

  // ── Busca o id_canal pelo token que veio no payload ──────────────────────
  const admin = serverSupabaseServiceRole<any>(event)

  const { data: canal, error: canalError } = await admin
    .from('canais')
    .select('id')
    .eq('token', body.token)
    .is('deleted_at', null)
    .maybeSingle()

  if (canalError) {
    console.error('❌ Erro ao buscar canal pelo token:', canalError.message)
    return { ok: false, error: 'canal_lookup_failed' }
  }

  if (!canal) {
    console.warn('⚠️ Nenhum canal encontrado para o token:', body.token)
    return { ok: true, skipped: true, reason: 'canal_not_found' }
  }

  // ── Normaliza o payload ──────────────────────────────────────────────────
  const normalizada = normalizarMensagem(body, canal.id)

  if (!normalizada) {
    return { ok: true, skipped: true, reason: 'message_ignored' }
  }

  const saved = await persistWebhookMensagem(admin, normalizada)

  if (!saved.ok) {
    console.error(`❌ Falha ao persistir (${saved.step}):`, saved.message)
    return { ok: false, error: 'persist_failed', step: saved.step, message: saved.message }
  }

  return { ok: true, saved: true, conversa_key: normalizada.conversa_key, message_id: normalizada.message_id }
})
