export type WebhookExecucaoStatus = 'processando' | 'ignorado' | 'sucesso' | 'erro'

export type WebhookExecucaoEtapa = {
  etapa: string
  ok: boolean
  ms?: number
  detalhe?: Record<string, unknown>
}

/** Linha completa de `public.webhook_uazapi_execucoes`. */
export type WebhookExecucaoRow = {
  id: string
  workspace_id: number | null
  id_canal: number | null
  event_type: string | null
  instance_name: string | null
  token_prefix: string | null
  status: WebhookExecucaoStatus
  motivo_ignorado: string | null
  erro_etapa: string | null
  erro_mensagem: string | null
  message_id: string | null
  conversa_key: string | null
  request_url: string | null
  user_agent: string | null
  etapas: WebhookExecucaoEtapa[]
  payload: Record<string, unknown> | null
  resposta: Record<string, unknown> | null
  iniciado_em: string
  finalizado_em: string | null
  duracao_ms: number | null
  created_at: string
}

/** Resumo retornado pela listagem (sem payload/etapas). */
export type WebhookExecucaoResumo = Omit<WebhookExecucaoRow, 'etapas' | 'payload' | 'resposta'> & {
  /** Preenchido via join com `canais` na API de listagem. */
  canal_nome?: string | null
  /** Host extraído de `request_url` (ex.: ngrok ou whats.construzap.com). */
  request_host?: string | null
  /** `ngrok` | `producao` | `outro` — classificação do host da requisição. */
  request_origem?: 'ngrok' | 'producao' | 'outro'
}

export type ListarWebhookExecucoesResponse = {
  execucoes: WebhookExecucaoResumo[]
  total: number
}

export type DetalheWebhookExecucaoResponse = {
  execucao: WebhookExecucaoRow & { canal_nome?: string | null }
}
