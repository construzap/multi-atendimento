import type { UazapiWebhookPayload } from '#shared/types/webhook'
import type { WebhookExecucaoEtapa, WebhookExecucaoStatus } from '#shared/types/webhookExecucao'

import type { MessageType } from '#shared/types/messageType'
import type { MensagemNormalizada } from '#shared/types/webhook'

/** Cliente retornado por `serverSupabaseServiceRole`. */
type SupabaseAdmin = ReturnType<
  typeof import('#supabase/server').serverSupabaseServiceRole<any>
>

export type WebhookExecucaoLogContext = {
  event_type?: string | null
  instance_name?: string | null
  token_prefix?: string | null
  request_url?: string | null
  user_agent?: string | null
  payload?: Record<string, unknown> | null
}

export type WebhookExecucaoFinalizarOpts = {
  status: WebhookExecucaoStatus
  workspace_id?: number | null
  id_canal?: number | null
  message_id?: string | null
  conversa_key?: string | null
  messagetype?: MessageType | string | null
  /** Valor persistido em `conversas.phone` (número 1:1 ou id @g.us em grupo). */
  phone?: string | null
  motivo_ignorado?: string | null
  erro_etapa?: string | null
  erro_mensagem?: string | null
  resposta?: Record<string, unknown> | null
}

export type WebhookExecucaoLog = {
  id: string | null
  registrarEtapa: (
    etapa: string,
    ok: boolean,
    detalhe?: Record<string, unknown>,
    ms?: number,
  ) => void
  finalizar: (opts: WebhookExecucaoFinalizarOpts) => Promise<void>
}

/** Mascara o token no payload antes de persistir. */
export function sanitizarPayloadUazapi(
  body: UazapiWebhookPayload | Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!body || typeof body !== 'object') return null
  try {
    const copia = structuredClone(body) as Record<string, unknown>
    if (typeof copia.token === 'string' && copia.token.length > 0) {
      copia.token = `${copia.token.slice(0, 8)}…`
    }
    return copia
  } catch {
    return { _erro: 'payload_nao_serializavel' }
  }
}

/** Telefone/id gravado em `conversas.phone` (mesma regra de persistWebhookMensagem). */
export function phoneConversaFromNormalizada(normalizada: MensagemNormalizada): string | null {
  if (normalizada.is_group && normalizada.id_group?.trim()) {
    return normalizada.id_group.trim()
  }
  const phone = normalizada.phone?.trim()
  return phone || null
}

/** Extrai messagetype + phone para o log de execução. */
export function dadosLogFromNormalizada(normalizada: MensagemNormalizada): {
  messagetype: MessageType
  phone: string | null
} {
  return {
    messagetype: normalizada.messagetype,
    phone: phoneConversaFromNormalizada(normalizada),
  }
}

const noopLog: WebhookExecucaoLog = {
  id: null,
  registrarEtapa: () => {},
  finalizar: async () => {},
}

/**
 * Cria registro inicial (`status = processando`) e expõe helpers para etapas e finalização.
 * Falhas de persistência não propagam — o webhook continua normalmente.
 */
export async function criarWebhookExecucaoLog(
  admin: SupabaseAdmin,
  ctx: WebhookExecucaoLogContext,
): Promise<WebhookExecucaoLog> {
  const iniciadoEm = new Date()
  const etapas: WebhookExecucaoEtapa[] = []
  let execucaoId: string | null = null

  try {
    const { data, error } = await admin
      .from('webhook_uazapi_execucoes')
      .insert({
        status: 'processando',
        event_type: ctx.event_type ?? null,
        instance_name: ctx.instance_name ?? null,
        token_prefix: ctx.token_prefix ?? null,
        request_url: ctx.request_url ?? null,
        user_agent: ctx.user_agent ?? null,
        payload: ctx.payload ?? null,
        iniciado_em: iniciadoEm.toISOString(),
        etapas: [],
      })
      .select('id')
      .single()

    if (error) {
      console.warn('[webhookExecucaoLog] falha no INSERT inicial:', error.message)
      return noopLog
    }

    execucaoId = typeof data?.id === 'string' ? data.id : null
    if (!execucaoId) {
      console.warn('[webhookExecucaoLog] INSERT sem id retornado')
      return noopLog
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn('[webhookExecucaoLog] exceção no INSERT inicial:', msg)
    return noopLog
  }

  const registrarEtapa = (
    etapa: string,
    ok: boolean,
    detalhe?: Record<string, unknown>,
    ms?: number,
  ) => {
    const item: WebhookExecucaoEtapa = { etapa, ok }
    if (ms != null && Number.isFinite(ms)) item.ms = Math.round(ms)
    if (detalhe && Object.keys(detalhe).length > 0) item.detalhe = detalhe
    etapas.push(item)
  }

  const finalizar = async (opts: WebhookExecucaoFinalizarOpts) => {
    if (!execucaoId) return

    const finalizadoEm = new Date()
    const duracaoMs = Math.max(0, finalizadoEm.getTime() - iniciadoEm.getTime())

    try {
      const { error } = await admin
        .from('webhook_uazapi_execucoes')
        .update({
          status: opts.status,
          workspace_id: opts.workspace_id ?? null,
          id_canal: opts.id_canal ?? null,
          message_id: opts.message_id ?? null,
          conversa_key: opts.conversa_key ?? null,
          messagetype: opts.messagetype ?? null,
          phone: opts.phone ?? null,
          motivo_ignorado: opts.motivo_ignorado ?? null,
          erro_etapa: opts.erro_etapa ?? null,
          erro_mensagem: opts.erro_mensagem ?? null,
          resposta: opts.resposta ?? null,
          etapas,
          finalizado_em: finalizadoEm.toISOString(),
          duracao_ms: duracaoMs,
        })
        .eq('id', execucaoId)

      if (error) {
        console.warn('[webhookExecucaoLog] falha no UPDATE final:', error.message)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.warn('[webhookExecucaoLog] exceção no UPDATE final:', msg)
    }
  }

  return { id: execucaoId, registrarEtapa, finalizar }
}
