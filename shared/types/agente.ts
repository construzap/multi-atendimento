/**
 * Contrato do endpoint público do agente IA (N8N → Nuxt).
 * POST /api/public/agente/responder
 */

export type AgenteResponderBody = {
  workspace_id: number
  conversa_key: string
  canal_id: number
  mensagem: string
  name?: string | null
  phone?: string | null
  /** Override; se omitido, o app lê `prompt_principal` no DB. */
  property_prompt?: string | null
  status_loja?: string | null
  endereco?: string | null
  horario_semana?: string | null
  horario_sabado?: string | null
  horario_domingo?: string | null
  latitude?: string | number | null
  longitude?: string | number | null
  numero?: string | null
  UUID?: string | null
  /** Instancia / token Uazapi */
  apikey?: string | null
  evoURL?: string | null
  url_uazapi?: string | null
  phone_PARA_NOTIFICAR?: string | null
  name_cliente_empresa?: string | null
  tempo_pausa?: string | number | null
  tempo_resposta?: string | number | null
  ai_assinatura_enabled?: boolean | string | null
  fase_teste?: string | number | boolean | null
  /** telefone remoto (orcamentopronto) */
  telefone?: string | null
  email?: string | null
  /** Chave Pix aleatória do workspace (pode ser null). */
  chave_pix_aleatoria?: string | null
  model?: string | null
  max_tool_rounds?: number | null
}

export type AgenteToolTraceItem = {
  name: string
  args: unknown
  http_status?: number
  result_preview: string
}

export type AgenteResponderResponse = {
  ok: true
  reply_text: string
  session_id: string
  model: string
  tool_trace: AgenteToolTraceItem[]
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
  }
}

/** Contexto interno após parse/validação do body. */
export type AgenteContext = {
  workspace_id: number
  conversa_key: string
  canal_id: number
  mensagem: string
  session_id: string
  name: string | null
  phone: string | null
  property_prompt: string | null
  status_loja: string | null
  endereco: string | null
  horario_semana: string | null
  horario_sabado: string | null
  horario_domingo: string | null
  latitude: string | null
  longitude: string | null
  numero: string | null
  UUID: string | null
  apikey: string | null
  evoURL: string | null
  url_uazapi: string | null
  phone_PARA_NOTIFICAR: string | null
  name_cliente_empresa: string | null
  tempo_pausa: string | null
  tempo_resposta: string | null
  ai_assinatura_enabled: string | null
  fase_teste: string | null
  telefone: string | null
  email: string | null
  /** Chave Pix aleatória; null se o workspace não tiver. */
  chave_pix_aleatoria: string | null
  model: string
  max_tool_rounds: number
  context_window: number
}
