import { serverSupabaseServiceRole } from '#supabase/server'
import type { UazapiWebhookPayload } from '#shared/types/webhook'
import type { PusherNovaMensagemPayload } from '#shared/types/mensagem'
import { mimeToExt, uploadToB2 } from '../../utils/b2Storage'
import { downloadUazapiMedia } from '../../utils/downloadUazapiMedia'
import { mensagemFromNormalizada } from '../../utils/mensagemFromNormalizada'
import { persistWebhookMensagem } from '../../utils/persistWebhookMensagem'
import { triggerNovaMensagem } from '../../utils/pusherServer'
import { isMediaMessage, normalizarMensagem } from '../../utils/webhookNormalizer'

/**
 * POST /api/webhook — chamada externa (sem sessão de usuário).
 *
 * Usa `serverSupabaseServiceRole` (SUPABASE_SECRET_KEY / service role), igual a
 * `server/api/perfil/me.patch.ts`, `server/api/mensagens/index.get.ts`, etc.: escrita
 * que precisa ignorar RLS e não tem `serverSupabaseClient` autenticado.
 */
export default defineEventHandler(async (event) => {
  const started = new Date().toISOString()
  const reqUrl = getRequestURL(event)
  const ua = getRequestHeader(event, 'user-agent') ?? '(sem User-Agent)'

  console.log('\n────────── [webhook] POST recebido ──────────')
  console.log('hora (ISO):', started)
  console.log('URL:', reqUrl.href)
  console.log('User-Agent (trecho):', String(ua).slice(0, 120))

  let body: UazapiWebhookPayload
  try {
    body = await readBody<UazapiWebhookPayload>(event)
  } catch (e) {
    console.error('[webhook] body inválido ou vazio:', e)
    return { ok: false, error: 'invalid_body' }
  }

  console.log('[webhook] payload completo (JSON):')
  console.log(JSON.stringify(body, null, 2))
  console.log('────────────────────────────────────────────\n')

  console.log(
    '[webhook] EventType:',
    body?.EventType ?? '(undefined)',
    '| instance:',
    body?.instanceName ?? '—',
    '| token:',
    body?.token ? `${String(body.token).slice(0, 8)}…` : '—',
  )

  // ── Filtra somente eventos de mensagem (demais serão ignorados por ora) ───
  if (body?.EventType !== 'messages') {
    console.log('[webhook] skip: evento não é "messages"')
    return { ok: true, skipped: true, reason: 'event_ignored' }
  }

  // ── Busca o id_canal pelo token que veio no payload ──────────────────────
  const admin = serverSupabaseServiceRole<any>(event)

  const { data: canal, error: canalError } = await admin
    .from('canais')
    .select('id, workspace_id')
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

  console.log('[webhook] canal id:', canal.id)

  // ── Normaliza o payload ──────────────────────────────────────────────────
  const workspaceId =
    canal && typeof canal === 'object' && 'workspace_id' in canal && typeof (canal as any).workspace_id === 'number'
      ? (canal as any).workspace_id
      : null

  const normalizada = normalizarMensagem(body, canal.id, workspaceId)

  if (!normalizada) {
    console.log('[webhook] skip: mensagem ignorada (grupo ou filtro interno)')
    return { ok: true, skipped: true, reason: 'message_ignored' }
  }

  if (body.message.mediaType === 'ptt' || body.message.mediaType === 'audio') {
    normalizada.messagetype = 'audioMessage'
  }

  if (isMediaMessage(body.message)) {
    const isAudio =
      body.message.mediaType === 'ptt' || body.message.mediaType === 'audio'
    const media = await downloadUazapiMedia(
      body.BaseUrl,
      body.token,
      normalizada.message_id,
      isAudio,
    )
    if (media) {
      const content = body.message.content as Record<string, unknown> | null
      const fileName =
        content && typeof content.fileName === 'string' ? content.fileName.trim() : null
      normalizada.filename = fileName || null

      const captionFromContent =
        content && typeof content.caption === 'string' ? content.caption.trim() : ''
      const textCaption = body.message.text?.trim() ?? ''
      normalizada.caption =
        captionFromContent || textCaption ? captionFromContent || textCaption : null

      const ext = mimeToExt(media.mimetype)
      const key = `midias/${normalizada.id_canal}/${normalizada.message_id}${ext}`
      try {
        normalizada.media_url = await uploadToB2(media.buffer, key, media.mimetype)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn(
          '[webhook] upload B2 falhou — salvando mensagem sem media_url. Corrija NUXT_B2_KEY_ID / NUXT_B2_APP_KEY no .env (Key ID completo no painel B2).',
          msg,
        )
      }
    }
  }

  const saved = await persistWebhookMensagem(admin, normalizada)

  if (!saved.ok) {
    console.error(`❌ Falha ao persistir (${saved.step}):`, saved.message)
    return { ok: false, error: 'persist_failed', step: saved.step, message: saved.message }
  }

  const payloadPusher: PusherNovaMensagemPayload = {
    conversa_key: saved.conversa_key,
    mensagem: mensagemFromNormalizada(normalizada, saved.conversa_key),
  }
  await triggerNovaMensagem(event, normalizada.id_canal, payloadPusher)

  console.log('[webhook] ok salvo:', normalizada.message_id, saved.conversa_key)

  return { ok: true, saved: true, conversa_key: saved.conversa_key, message_id: normalizada.message_id }
})
