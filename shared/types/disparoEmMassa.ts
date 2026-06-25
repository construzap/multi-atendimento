export type CampanhaTipoMensagem = 'texto' | 'imagem' | 'video' | 'audio'
export type CampanhaStatus = 'rascunho' | 'processando' | 'pausado' | 'concluido'
/** Status permitidos ao criar campanha. */
export type CampanhaStatusCriacao = 'rascunho' | 'processando'
export type FilaDisparoStatus = 'pendente' | 'agendado' | 'enviado' | 'erro'

/** Corpo de `POST /api/kanban/disparo_em_massa`. */
export type CriarCampanhaBody = {
  workspace_id: number
  nome: string
  status: CampanhaStatusCriacao
  tipo_mensagem: CampanhaTipoMensagem
  conteudo_texto?: string | null
  /** Um ou mais canais de envio. */
  canais_ids: number[]
  coluna_ids: number[]
  intervalo_minimo_minutos: number
  intervalo_maximo_minutos: number
  /** `yyyy-mm-dd` no fuso local do formulário. */
  data_local: string
  /** `HH:mm` no mesmo fuso. */
  hora_local: string
  /** Janela diária permitida para disparos (`HH:mm`). */
  hora_permitida_inicio: string
  /** Janela diária permitida para disparos (`HH:mm`). */
  hora_permitida_fim: string
  /** Se a IA permanece ativa para os contatos após o disparo. */
  ia_ligada: boolean
  /** Visualização única (apenas imagem ou áudio). */
  visualizacao_unica?: boolean
  mime?: string | null
  data_base64?: string | null
  filename?: string | null
}

export type CampanhaRow = {
  id: string
  nome: string
  tipo_mensagem: CampanhaTipoMensagem
  conteudo_texto: string | null
  url_midia: string | null
  webhook_url: string
  intervalo_minimo_minutos: number | null
  intervalo_maximo_minutos: number | null
  status: CampanhaStatus | null
  criado_em: string | null
  canal_id: number | null
  canais_ids: number[] | null
  ultimo_canal_id: number | null
  data_inicio: string | null
  total_contatos: number | null
  total_enviados: number | null
  proximo_disparo: string | null
  ia_ligada: boolean | null
  visualizacao_unica: boolean | null
  hora_permitida_inicio: string | null
  hora_permitida_fim: string | null
}

/** Item retornado por `GET /api/kanban/disparo_em_massa`. */
export type CampanhaListItem = Pick<
  CampanhaRow,
  | 'id'
  | 'nome'
  | 'tipo_mensagem'
  | 'conteudo_texto'
  | 'url_midia'
  | 'webhook_url'
  | 'intervalo_minimo_minutos'
  | 'intervalo_maximo_minutos'
  | 'status'
  | 'canal_id'
  | 'canais_ids'
  | 'data_inicio'
  | 'total_contatos'
  | 'total_enviados'
  | 'proximo_disparo'
  | 'ia_ligada'
  | 'visualizacao_unica'
  | 'hora_permitida_inicio'
  | 'hora_permitida_fim'
>

/** Resposta de `GET /api/kanban/disparo_em_massa`. */
export type ListarCampanhasResponse = {
  campanhas: CampanhaListItem[]
}

export type FilaDisparoRow = {
  id: string
  campanha_id: string | null
  conversa_key: string
  status: FilaDisparoStatus | null
  agendado_para: string | null
  mensagem_erro: string | null
  enviado_em: string | null
  criado_em: string | null
}

/** Resposta de `POST /api/kanban/disparo_em_massa`. */
export type CriarCampanhaResponse = {
  campanha: CampanhaRow
  conversa_keys: string[]
}

/** Corpo de `POST /api/kanban/disparo_em_massa/fila`. */
export type EnfileirarFilaDisparoBody = {
  campanha_id: string
  conversa_keys: string[]
}

/** Resposta de `POST /api/kanban/disparo_em_massa/fila`. */
export type EnfileirarFilaDisparoResponse = {
  inseridos: number
  fila_disparos: FilaDisparoRow[]
}

/** Corpo de `POST /api/kanban/disparo_em_massa/upload-midia`. */
export type DisparoEmMassaMidiaUploadBody = {
  workspace_id: number
  mensagem_type: 'imagem' | 'audio'
  mime: string
  data_base64: string
  filename?: string | null
}

/** Resposta de `POST /api/kanban/disparo_em_massa/upload-midia`. */
export type DisparoEmMassaMidiaUploadResponse = {
  ok: true
  url: string
  key: string
  filename: string | null
  mime: string
  size: number
}
