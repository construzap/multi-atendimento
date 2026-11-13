import { serverSupabaseServiceRole } from '#supabase/server'
import type { MensagemNormalizada, UazapiWebhookPayload } from '#shared/types/webhook'
import type { PusherNovaMensagemPayload } from '#shared/types/mensagem'
import { normalizeWhatsappBr } from '#shared/utils/normalizeWhatsappBr'
import { normalizarLabelId } from '#shared/utils/validarCanalCamposExtras'
import { mimeToExt, uploadToB2 } from '../../utils/b2Storage'
import { atualizarEtiquetasConversaWhatsapp } from '../../utils/canalWhatsappLabels'
import { downloadUazapiMedia } from '../../utils/downloadUazapiMedia'
import { mensagemFromNormalizada } from '../../utils/mensagemFromNormalizada'
import { persistWebhookMensagem } from '../../utils/persistWebhookMensagem'
import { triggerNovaMensagem } from '../../utils/pusherServer'
import {
  criarWebhookExecucaoLog,
  dadosLogFromNormalizada,
  sanitizarPayloadUazapi,
} from '../../utils/webhookExecucaoLog'
import { isMediaMessage, normalizarMensagem, resolveUazapiMediaType } from '../../utils/webhookNormalizer'

/** Número do contato para `POST /chat/labels` (1:1). */
function numberParaEtiquetasWhatsapp(normalizada: MensagemNormalizada): string | null {
  if (normalizada.is_group) return null
  const phone = typeof normalizada.phone === 'string' ? normalizada.phone.trim() : ''
  if (phone) {
    if (phone.includes('@')) return phone
    const digits = phone.replace(/\D/g, '')
    if (!digits) return null
    return normalizeWhatsappBr(digits) || digits
  }
  const lid = typeof normalizada.lid === 'string' ? normalizada.lid.trim() : ''
  if (!lid) return null
  if (lid.includes('@')) return lid
  const lidDigits = lid.replace(/\D/g, '')
  return lidDigits ? `${lidDigits}@lid` : null
}

/**
 * Cliente → só a etiqueta de atendimento (`id_da_lista_de_atendimento_do_whatsapp`).
 * Vendedor (não IA):
 * - follow-up agendado + etiqueta etapa 1 → `labelids: [etiqueta]`
 * - senão → limpa (`labelids: []`)
 * I.A. / grupo → não chama.
 */
async function tentarAtualizarEtiquetasNoWebhook(input: {
  servidor: string | null
  token: string | null
  listaAtendimentoId: string | null
  normalizada: MensagemNormalizada
  follow_up_agendado?: boolean
  follow_up_etiqueta_etapa_1?: string | null
}): Promise<void> {
  const { normalizada } = input
  if (normalizada.from_me && normalizada.from_ia) return

  const servidor = input.servidor?.trim() || ''
  const token = input.token?.trim() || ''
  if (!servidor || !token) return

  const number = numberParaEtiquetasWhatsapp(normalizada)
  if (!number) return

  let labelids: string[]
  if (!normalizada.from_me) {
    const lista = input.listaAtendimentoId?.trim() || ''
    if (!lista) return
    labelids = [lista]
  } else if (input.follow_up_agendado) {
    const etiqueta = input.follow_up_etiqueta_etapa_1?.trim() || ''
    labelids = etiqueta ? [etiqueta] : []
  } else {
    // Vendedor sem ativação de follow-up: limpa etiquetas.
    labelids = []
  }

  await atualizarEtiquetasConversaWhatsapp({
    servidor,
    token,
    number,
    labelids,
  })
}

/**
 * POST /api/webhook — chamada externa (sem sessão de usuário).
 *
 * Qualquer host público que aponte para este app grava log (ngrok, whats.construzap.com, etc.).
 * O campo `request_url` guarda a URL completa recebida — não há filtro por domínio.
 *
 * Usa `serverSupabaseServiceRole` (SUPABASE_SECRET_KEY / service role), igual a
 * `server/api/perfil/me.patch.ts`, `server/api/mensagens/index.get.ts`, etc.: escrita
 * que precisa ignorar RLS e não tem `serverSupabaseClient` autenticado.
 */
export default defineEventHandler(async (event) => {
  const started = new Date().toISOString()
  const reqUrl = getRequestURL(event)
  const ua = getRequestHeader(event, 'user-agent') ?? '(sem User-Agent)'
  const admin = serverSupabaseServiceRole<any>(event)

  console.log('\n────────── [webhook] POST recebido ──────────')
  console.log('hora (ISO):', started)
  console.log('URL:', reqUrl.href)
  console.log('User-Agent (trecho):', String(ua).slice(0, 120))

  let body: UazapiWebhookPayload
  try {
    body = await readBody<UazapiWebhookPayload>(event)
  } catch (e) {
    console.error('[webhook] body inválido ou vazio:', e)
    const log = await criarWebhookExecucaoLog(admin, {
      request_url: reqUrl.href,
      user_agent: ua,
      payload: null,
    })
    log.registrarEtapa('parse_body', false, {
      erro: e instanceof Error ? e.message : String(e),
    })
    await log.finalizar({
      status: 'erro',
      erro_etapa: 'parse_body',
      erro_mensagem: e instanceof Error ? e.message : 'invalid_body',
      resposta: { ok: false, error: 'invalid_body' },
    })
    return { ok: false, error: 'invalid_body' }
  }

  const log = await criarWebhookExecucaoLog(admin, {
    event_type: body?.EventType ?? null,
    instance_name: body?.instanceName ?? null,
    token_prefix: body?.token ? String(body.token).slice(0, 8) : null,
    request_url: reqUrl.href,
    user_agent: ua,
    payload: sanitizarPayloadUazapi(body),
  })
  log.registrarEtapa('parse_body', true)

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

  if (body?.EventType !== 'messages') {
    console.log('[webhook] skip: evento não é "messages"')
    log.registrarEtapa('filtro_event_type', false, {
      event_type: body?.EventType ?? null,
      esperado: 'messages',
    })
    const resposta = { ok: true, skipped: true, reason: 'event_ignored' }
    await log.finalizar({
      status: 'ignorado',
      motivo_ignorado: 'event_ignored',
      resposta,
    })
    return resposta
  }

  log.registrarEtapa('filtro_event_type', true, { event_type: 'messages' })

  const tCanal = Date.now()
  const { data: canal, error: canalError } = await admin
    .from('canais')
    .select(
      'id, workspace_id, botao_para_iniciar_ia, config_follow_up, palavras_ativacao_follow_up, servidor, token, id_da_lista_de_atendimento_do_whatsapp',
    )
    .eq('token', body.token)
    .is('deleted_at', null)
    .maybeSingle()

  if (canalError) {
    console.error('❌ Erro ao buscar canal pelo token:', canalError.message)
    log.registrarEtapa('canal_lookup', false, { erro: canalError.message }, Date.now() - tCanal)
    const resposta = { ok: false, error: 'canal_lookup_failed' }
    await log.finalizar({
      status: 'erro',
      erro_etapa: 'canal_lookup',
      erro_mensagem: canalError.message,
      resposta,
    })
    return resposta
  }

  if (!canal) {
    console.warn('⚠️ Nenhum canal encontrado para o token:', body.token)
    log.registrarEtapa(
      'canal_lookup',
      false,
      { token_prefix: body?.token ? String(body.token).slice(0, 8) : null },
      Date.now() - tCanal,
    )
    const resposta = { ok: true, skipped: true, reason: 'canal_not_found' }
    await log.finalizar({
      status: 'ignorado',
      motivo_ignorado: 'canal_not_found',
      resposta,
    })
    return resposta
  }

  console.log('[webhook] canal id:', canal.id)

  const workspaceId =
    canal && typeof canal === 'object' && 'workspace_id' in canal && typeof (canal as any).workspace_id === 'number'
      ? (canal as any).workspace_id
      : null

  log.registrarEtapa(
    'canal_lookup',
    true,
    {
      id_canal: canal.id,
      workspace_id: workspaceId,
      botao_para_iniciar_ia:
        (canal as { botao_para_iniciar_ia?: unknown }).botao_para_iniciar_ia === true,
    },
    Date.now() - tCanal,
  )

  const tNorm = Date.now()
  const normalizada = normalizarMensagem(body, canal.id, workspaceId)

  if (!normalizada) {
    console.log('[webhook] skip: mensagem ignorada (sem identificador ou filtro interno)')
    log.registrarEtapa('normalizar_mensagem', false, undefined, Date.now() - tNorm)
    const resposta = { ok: true, skipped: true, reason: 'message_ignored' }
    await log.finalizar({
      status: 'ignorado',
      workspace_id: workspaceId,
      id_canal: canal.id,
      motivo_ignorado: 'message_ignored',
      resposta,
    })
    return resposta
  }

  log.registrarEtapa('normalizar_mensagem', true, undefined, Date.now() - tNorm)

  if (body.message.mediaType === 'ptt' || body.message.mediaType === 'audio') {
    normalizada.messagetype = 'audioMessage'
  }

  const uazapiMediaType = resolveUazapiMediaType(body.message)
  if (uazapiMediaType === 'ptt' || uazapiMediaType === 'audio') {
    normalizada.messagetype = 'audioMessage'
  }

  if (isMediaMessage(body.message)) {
    const isAudio = uazapiMediaType === 'ptt' || uazapiMediaType === 'audio'
    const tDownload = Date.now()
    const media = await downloadUazapiMedia(
      body.BaseUrl,
      body.token,
      normalizada.message_id,
      isAudio,
    )
    if (media) {
      log.registrarEtapa(
        'download_midia',
        true,
        { mediaType: uazapiMediaType ?? body.message.mediaType },
        Date.now() - tDownload,
      )

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
      const tUpload = Date.now()
      try {
        normalizada.media_url = await uploadToB2(media.buffer, key, media.mimetype)
        log.registrarEtapa('upload_b2', true, { key }, Date.now() - tUpload)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        log.registrarEtapa('upload_b2', false, { erro: msg }, Date.now() - tUpload)
        console.warn(
          '[webhook] upload B2 falhou — salvando mensagem sem media_url. Corrija NUXT_B2_KEY_ID / NUXT_B2_APP_KEY no .env (Key ID completo no painel B2).',
          msg,
        )
      }
    } else {
      log.registrarEtapa(
        'download_midia',
        false,
        { mediaType: uazapiMediaType ?? body.message.mediaType },
        Date.now() - tDownload,
      )
    }
  }

  const botaoParaIniciarIa =
    canal && typeof canal === 'object' && 'botao_para_iniciar_ia' in canal
      ? (canal as { botao_para_iniciar_ia?: unknown }).botao_para_iniciar_ia === true
      : false

  const configFollowUp =
    canal && typeof canal === 'object' && 'config_follow_up' in canal
      ? (canal as { config_follow_up?: unknown }).config_follow_up
      : null

  const palavrasAtivacaoFollowUp =
    canal && typeof canal === 'object' && 'palavras_ativacao_follow_up' in canal
      ? (canal as { palavras_ativacao_follow_up?: unknown }).palavras_ativacao_follow_up
      : null

  const canalServidor =
    canal && typeof canal === 'object' && typeof (canal as { servidor?: unknown }).servidor === 'string'
      ? String((canal as { servidor: string }).servidor).trim()
      : null
  const canalToken =
    canal && typeof canal === 'object' && typeof (canal as { token?: unknown }).token === 'string'
      ? String((canal as { token: string }).token).trim()
      : typeof body.token === 'string'
        ? body.token.trim()
        : null
  const listaAtendimentoId = normalizarLabelId(
    canal && typeof canal === 'object'
      ? (canal as { id_da_lista_de_atendimento_do_whatsapp?: unknown })
          .id_da_lista_de_atendimento_do_whatsapp
      : null,
  )

  const tPersist = Date.now()
  const saved = await persistWebhookMensagem(admin, normalizada, {
    botao_para_iniciar_ia: botaoParaIniciarIa,
    config_follow_up: configFollowUp,
    palavras_ativacao_follow_up: palavrasAtivacaoFollowUp,
  })

  if (!saved.ok) {
    console.error(`❌ Falha ao persistir (${saved.step}):`, saved.message)
    log.registrarEtapa('persistir_mensagem', false, { step: saved.step }, Date.now() - tPersist)
    const resposta = { ok: false, error: 'persist_failed', step: saved.step, message: saved.message }
    await log.finalizar({
      status: 'erro',
      workspace_id: workspaceId,
      id_canal: canal.id,
      message_id: normalizada.message_id,
      ...dadosLogFromNormalizada(normalizada),
      erro_etapa: saved.step,
      erro_mensagem: saved.message,
      resposta,
    })
    return resposta
  }

  log.registrarEtapa(
    'persistir_mensagem',
    true,
    { conversa_key: saved.conversa_key },
    Date.now() - tPersist,
  )

  const tLabels = Date.now()
  try {
    await tentarAtualizarEtiquetasNoWebhook({
      servidor: canalServidor,
      token: canalToken,
      listaAtendimentoId,
      normalizada,
      follow_up_agendado: saved.follow_up_agendado === true,
      follow_up_etiqueta_etapa_1: saved.follow_up_etiqueta_etapa_1 ?? null,
    })
    log.registrarEtapa('etiquetas_whatsapp', true, undefined, Date.now() - tLabels)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    log.registrarEtapa('etiquetas_whatsapp', false, { erro: msg }, Date.now() - tLabels)
    console.warn('[webhook] etiquetas WhatsApp falhou (mensagem já salva):', msg)
  }

  // 1:1: não enviar mensagem.name no Pusher — clientes antigos sobrescreviam conversas.name
  // com o nome do WhatsApp. O nome editável vai só em `conversa_name` (lido do banco).
  const mensagemPusher = mensagemFromNormalizada(normalizada, saved.conversa_key)
  if (!normalizada.is_group) {
    mensagemPusher.name = null
  }

  const payloadPusher: PusherNovaMensagemPayload = {
    conversa_key: saved.conversa_key,
    mensagem: mensagemPusher,
    conversa_name: saved.conversa_name ?? null,
    ...(normalizada.is_group
      ? {
          is_group: true,
          id_group: normalizada.id_group,
          name_group: normalizada.name_group,
          conversa_photo: normalizada.photo,
        }
      : {}),
  }

  const tPusher = Date.now()
  const deveNotificarPusher =
    saved.message_persisted !== false && Boolean(saved.conversa_key?.trim())

  if (deveNotificarPusher) {
    try {
      await triggerNovaMensagem(event, normalizada.id_canal, payloadPusher)
      log.registrarEtapa('pusher_nova_mensagem', true, undefined, Date.now() - tPusher)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      log.registrarEtapa('pusher_nova_mensagem', false, { erro: msg }, Date.now() - tPusher)
      console.warn('[webhook] pusher falhou (mensagem já salva):', msg)
    }
  } else {
    log.registrarEtapa('pusher_nova_mensagem', true, { ignorado: 'mensagem_ja_existe_no_canal' }, Date.now() - tPusher)
  }

  console.log('[webhook] ok salvo:', normalizada.message_id, saved.conversa_key)

  const resposta = {
    ok: true,
    saved: true,
    conversa_key: saved.conversa_key,
    message_id: normalizada.message_id,
  }

  log.registrarEtapa('concluido', true)
  await log.finalizar({
    status: 'sucesso',
    workspace_id: workspaceId,
    id_canal: canal.id,
    message_id: normalizada.message_id,
    conversa_key: saved.conversa_key,
    ...dadosLogFromNormalizada(normalizada),
    resposta,
  })

  return resposta
})
