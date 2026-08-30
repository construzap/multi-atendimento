import { assertMethod, createError, readBody } from 'h3'
import { requireN8nAgenteApiKey } from '../../../utils/requireN8nAgenteApiKey'
import { assertAdminWorkspaceAtivo } from '../../../utils/adminPrompt'
import { buildSystemPrompt, loadPromptPrincipalTexto } from '../../../utils/agente/buildSystemPrompt'
import { loadCanalAgenteCredenciais } from '../../../utils/agente/loadCanalCredenciais'
import {
  buildAgenteSessionId,
  loadAgenteHistory,
  saveAgenteTurn,
} from '../../../utils/agente/memory'
import { runAgentLoop } from '../../../utils/agente/runAgentLoop'
import type { AgenteContext, AgenteResponderResponse } from '#shared/types/agente'

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

function strOrEmpty(v: unknown): string {
  return strOrNull(v) ?? ''
}

/** Aceita boolean, "true"/"false", 1/0; null se ausente/inválido. */
function boolOrNull(v: unknown): boolean | null {
  if (v === undefined || v === null || v === '') return null
  if (typeof v === 'boolean') return v
  if (v === 1 || v === '1') return true
  if (v === 0 || v === '0') return false
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase()
    if (s === 'true') return true
    if (s === 'false') return false
  }
  return null
}

/** Aceita objeto de taxas ou JSON string; null se vazio/inválido. */
function taxasCartaoOrNull(v: unknown): Record<string, number> | string | null {
  if (v === undefined || v === null) return null
  if (typeof v === 'string') {
    const s = v.trim()
    if (!s) return null
    try {
      const parsed = JSON.parse(s) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, number>
      }
    } catch {
      /* mantém string crua se N8N mandar texto */
    }
    return s
  }
  if (typeof v === 'object' && !Array.isArray(v)) {
    return v as Record<string, number>
  }
  return null
}

/**
 * Endpoint público chamado pelo N8N no lugar do nó LangChain Agent.
 * Auth: Bearer / x-api-key com NUXT_N8N_AGENTE_API_KEY.
 */
export default defineEventHandler(async (event): Promise<AgenteResponderResponse> => {
  assertMethod(event, 'POST')
  requireN8nAgenteApiKey(event)

  const body = (await readBody(event)) as Record<string, unknown> | null
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Body JSON inválido.' })
  }

  const workspace_id = parsePositiveInt(body.workspace_id, 'workspace_id')
  const canal_id = parsePositiveInt(body.canal_id, 'canal_id')
  const conversa_key = strOrEmpty(body.conversa_key)
  if (!conversa_key) {
    throw createError({ statusCode: 400, statusMessage: 'conversa_key é obrigatório.' })
  }

  const mensagem = strOrEmpty(body.mensagem)
  if (!mensagem) {
    throw createError({ statusCode: 400, statusMessage: 'mensagem é obrigatória.' })
  }

  await assertAdminWorkspaceAtivo(event, workspace_id)

  const canalCredenciais = await loadCanalAgenteCredenciais(event, {
    workspace_id,
    canal_id,
  })

  const config = useRuntimeConfig(event)
  const defaultModel = String(config.openaiAgentModel || 'gpt-4.1-mini-2025-04-14').trim()
  const maxRoundsDefault = Number.parseInt(String(config.agenteMaxToolRounds || '8'), 10)
  const contextWindowDefault = Number.parseInt(String(config.agenteContextWindow || '26'), 10)

  const modelOverride = strOrNull(body.model)
  const maxRoundsBody =
    body.max_tool_rounds != null
      ? Number.parseInt(String(body.max_tool_rounds), 10)
      : NaN

  const ctx: AgenteContext = {
    workspace_id,
    conversa_key,
    canal_id,
    mensagem,
    session_id: buildAgenteSessionId(workspace_id, conversa_key),
    name: strOrNull(body.name),
    phone: strOrNull(body.phone),
    property_prompt: strOrNull(body.property_prompt),
    status_loja: strOrNull(body.status_loja),
    endereco: strOrNull(body.endereco),
    horario_semana: strOrNull(body.horario_semana),
    horario_sabado: strOrNull(body.horario_sabado),
    horario_domingo: strOrNull(body.horario_domingo),
    latitude: strOrNull(body.latitude),
    longitude: strOrNull(body.longitude),
    numero: strOrNull(body.numero),
    UUID: strOrNull(body.UUID),
    apikey: strOrNull(body.apikey),
    evoURL: strOrNull(body.evoURL),
    url_uazapi: strOrNull(body.url_uazapi),
    phone_PARA_NOTIFICAR: strOrNull(body.phone_PARA_NOTIFICAR),
    name_canal_cliente: strOrNull(body.name_canal_cliente),
    tempo_pausa: strOrNull(body.tempo_pausa),
    tempo_resposta: strOrNull(body.tempo_resposta),
    ai_assinatura_enabled: strOrNull(body.ai_assinatura_enabled),
    fase_teste: strOrNull(body.fase_teste),
    telefone: strOrNull(body.telefone),
    email: strOrNull(body.email),
    chave_pix_aleatoria: strOrNull(
      body.chave_pix_aleatoria ?? body.CHAVE_PIX_ALEATORIA,
    ),
    provedor_pagamentos: strOrNull(body.provedor_pagamentos),
    credenciais_encrypted: strOrNull(
      body.credenciais_encrypted ?? body.credenciais_pagarme_encrypted,
    ),
    taxas_cartao: taxasCartaoOrNull(body.taxas_cartao),
    loja_aberta: boolOrNull(body.loja_aberta),
    agenda_pedido: boolOrNull(body.agenda_pedido),
    model: modelOverride || canalCredenciais.model_name || defaultModel,
    max_tool_rounds:
      Number.isFinite(maxRoundsBody) && maxRoundsBody > 0
        ? Math.min(maxRoundsBody, 20)
        : Number.isFinite(maxRoundsDefault) && maxRoundsDefault > 0
          ? maxRoundsDefault
          : 8,
    context_window:
      Number.isFinite(contextWindowDefault) && contextWindowDefault > 0
        ? contextWindowDefault
        : 26,
  }

  let promptBase = ctx.property_prompt
  if (!promptBase) {
    promptBase = await loadPromptPrincipalTexto(event, workspace_id)
  }
  if (!promptBase) {
    throw createError({
      statusCode: 400,
      statusMessage:
        'property_prompt ausente e workspace sem prompt_principal configurado.',
    })
  }

  const systemPrompt = buildSystemPrompt(ctx, promptBase)
  const history = await loadAgenteHistory(event, ctx.session_id, ctx.context_window)

  const result = await runAgentLoop(event, {
    ctx,
    systemPrompt,
    history,
    openai: {
      apiKey: canalCredenciais.api_key,
      baseUrl: canalCredenciais.url,
    },
  })

  await saveAgenteTurn(event, ctx, result.new_messages)

  return {
    ok: true,
    reply_text: result.reply_text,
    session_id: ctx.session_id,
    model: ctx.model,
    tool_trace: result.tool_trace,
    usage: result.usage,
  }
})
