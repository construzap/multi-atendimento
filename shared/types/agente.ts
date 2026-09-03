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
  name_canal_cliente?: string | null
  tempo_pausa?: string | number | null
  tempo_resposta?: string | number | null
  ai_assinatura_enabled?: boolean | string | null
  fase_teste?: string | number | boolean | null
  /** telefone remoto (orcamentopronto) */
  telefone?: string | null
  email?: string | null
  /** Chave Pix aleatória do workspace (pode ser null). */
  chave_pix_aleatoria?: string | null
  /** Provedor de pagamento do canal (ex.: pagar.me, asaas). */
  provedor_pagamentos?: string | null
  /** Credenciais de pagamento criptografadas (coluna canais.credenciais_encrypted). */
  credenciais_encrypted?: string | null
  /** Taxas de cartão do canal (objeto tipo { "1x": 0, "2x": 4.5, ... }). */
  taxas_cartao?: Record<string, number> | string | null
  /** Se a loja está aberta no momento. */
  loja_aberta?: boolean | null
  /** Se a loja aceita agendar pedido. */
  agenda_pedido?: boolean | null
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

/**
 * Resposta dos agentes especializados (sem memória).
 * `output` espelha o campo do nó LangChain Agent no N8N.
 */
export type AgenteEspecializadoResponse = {
  ok: true
  reply_text: string
  output: string
  model: string
  tool_trace: AgenteToolTraceItem[]
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
  }
  /** Só em filtrar-produtos, se o JSON da IA for parseável. */
  produtos?: unknown
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
  name_canal_cliente: string | null
  tempo_pausa: string | null
  tempo_resposta: string | null
  ai_assinatura_enabled: string | null
  fase_teste: string | null
  telefone: string | null
  email: string | null
  /** Chave Pix aleatória; null se o workspace não tiver. */
  chave_pix_aleatoria: string | null
  provedor_pagamentos: string | null
  credenciais_encrypted: string | null
  taxas_cartao: Record<string, number> | string | null
  loja_aberta: boolean | null
  agenda_pedido: boolean | null
  model: string
  max_tool_rounds: number
  context_window: number
}
