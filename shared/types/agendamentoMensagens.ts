/** Valores enviados em `mensagem_type` (alinhado ao formulário). */
export type AgendamentoMensagemTipo = 'texto' | 'imagem' | 'audio'

/** Recorrência enviada no corpo; o servidor converte em `recorrente` + `intervalo_recorrencia`. */
export type AgendamentoMensagemRecorrenciaInserir =
  | 'unico'
  | 'diaria'
  | 'semanal'
  | 'mensal'
  | 'anual'

/**
 * Corpo de `POST /api/agendamento-de-mensagem`.
 * `workspace_id` deve corresponder ao workspace atual (validado no servidor).
 */
export type AgendamentoMensagemInserirBody = {
  workspace_id: number
  /** Canal de envio (`canais.id`) no mesmo workspace. */
  id_canal: number
  nomecliente?: string | null
  telefone?: string | null
  mensagem_type: AgendamentoMensagemTipo
  mensagem_texto?: string | null
  midia_url?: string | null
  /** Data no fuso `iana_timezone`, formato `yyyy-mm-dd`. */
  data_local: string
  /** Hora no mesmo fuso, `HH:mm` (24h). */
  hora_local: string
  /** Fuso IANA (lista Brasil validada no servidor). */
  iana_timezone: string
  recorrencia?: AgendamentoMensagemRecorrenciaInserir
}

/** Corpo de `PATCH /api/agendamento-de-mensagem/:id` — mesmos campos do insert (sem `status`; mantém o existente). */
export type AgendamentoMensagemAtualizarBody = AgendamentoMensagemInserirBody

/** Corpo de `POST /api/agendamento-de-mensagem/upload-midia`. */
export type AgendamentoMidiaUploadBody = {
  workspace_id: number
  mensagem_type: 'imagem' | 'audio'
  mime: string
  data_base64: string
  filename?: string | null
}

/** Resposta de `POST /api/agendamento-de-mensagem/upload-midia`. */
export type AgendamentoMidiaUploadResponse = {
  ok: true
  url: string
  key: string
  filename: string | null
  mime: string
  size: number
}

/** Campos retornados por `GET /api/agendamento-de-mensagem?workspace_id=&year=&month=`. */
export type AgendamentoMensagemListItem = {
  id: number
  nomecliente: string | null
  telefone: string | null
  mensagem_type: string | null
  mensagem_texto: string | null
  midia_url: string | null
  data_agendada: string
  iana_timezone: string | null
  recorrente: boolean | null
  /** Postgres `interval` — em geral string na resposta JSON. */
  intervalo_recorrencia: string | null
  status: string | null
  id_canal: number | null
}

export type AgendamentoMensagemListResponse = {
  items: AgendamentoMensagemListItem[]
  /** Total de linhas no intervalo do mês (antes do `limit`). */
  total: number
  page: number
  page_size: number
}

/** Linha de `public.agendamentos_mensagens` após insert/select. */
export type AgendamentoMensagemRow = {
  id: number
  created_at: string | null
  workspace_id: number
  id_canal: number | null
  nomecliente: string | null
  telefone: string | null
  mensagem_type: string | null
  mensagem_texto: string | null
  midia_url: string | null
  data_agendada: string
  /** Fuso IANA usado ao agendar (persistido). */
  iana_timezone: string | null
  status: string | null
  recorrente: boolean | null
  /** Postgres `interval` — o cliente recebe em geral como string. */
  intervalo_recorrencia: string | null
}
