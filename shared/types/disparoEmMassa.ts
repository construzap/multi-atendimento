export type CampanhaTipoMensagem = 'texto' | 'imagem' | 'video' | 'audio'
export type CampanhaStatus = 'rascunho' | 'processando' | 'pausado' | 'concluido'
/** Status permitidos ao criar campanha. */
export type CampanhaStatusCriacao = 'rascunho' | 'processando'
export type FilaDisparoStatus = 'pendente' | 'agendado' | 'enviado' | 'erro'

/** Item da sequência de mensagens enviada no POST/PATCH. */
export type CampanhaSequenciaItemBody = {
  tipo: CampanhaTipoMensagem
  texto?: string | null
  mime?: string | null
  data_base64?: string | null
  filename?: string | null
  /** URL já persistida (edição sem trocar mídia). */
  url_midia?: string | null
}

/** Corpo de `POST /api/kanban/disparo_em_massa`. */
export type CriarCampanhaBody = {
  workspace_id: number
  nome: string
  status: CampanhaStatusCriacao
  /**
   * Tipo da 1ª mensagem (legado / compatibilidade).
   * Preferir `sequencia` quando houver múltiplas mensagens.
   */
  tipo_mensagem: CampanhaTipoMensagem
  conteudo_texto?: string | null
  /** Sequência de mensagens a enviar na ordem. */
  sequencia?: CampanhaSequenciaItemBody[]
  /** Um ou mais canais de envio. */
  canais_ids: number[]
  coluna_ids: number[]
  /** Funil da coluna de destinatários (`funil_workspace.id` como texto). */
  funil_id?: string | null
  /** Coluna do funil para mover o contato após o disparo (`null` = não mover). */
  coluna_id?: number | null
  /** Coluna do funil para mover o contato se o envio falhar. */
  coluna_erro_id: number
  /** Funil da coluna de erro (`funil_workspace.id` como texto). */
  funil_erro_id?: string | null
  /** Filtro opcional: canais de origem dos destinatários (persistido em `fonte_canal_id` como csv). */
  fonte_canais_ids?: number[]
  /** @deprecated use fonte_canais_ids — csv legado em `fonte_canal_id`. */
  fonte_canal_id?: string | null
  /** Incluir conversas de grupo WhatsApp na fila. */
  envia_para_grupo?: boolean
  intervalo_minimo_minutos: number
  intervalo_maximo_minutos: number
  /** Quantidade de disparos por lote. */
  tamanho_lote: number
  /** Pausa em minutos entre lotes. */
  pausa_lote_minutos: number
  /** `yyyy-mm-dd` no fuso local do formulário. */
  data_local: string
  /** `HH:mm` no mesmo fuso. */
  hora_local: string
  /** IANA do fuso escolhido para data/hora de início (`timezone_escolhido`). */
  timezone_escolhido: string
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
  fonte_canal_id: string | null
  envia_para_grupo: boolean | null
  /** Coluna do funil para mover o contato após o disparo. */
  coluna_id: number | null
  /** Funil relacionado às colunas de destinatários. */
  funil_id: string | null
  timezone_escolhido: string | null
  /** Quantidade de disparos por lote. */
  tamanho_lote: number | null
  /** Pausa em minutos entre lotes. */
  pausa_lote_minutos: number | null
  /** Coluna do funil para mover o contato em caso de erro no disparo. */
  coluna_erro_id: number | null
  /** Funil da coluna de erro (`funil_workspace.id` como texto). */
  funil_erro_id: string | null
  /** Tipos das mensagens na sequência de envio. */
  sequencia_tipos: CampanhaTipoMensagem[] | null
  /** Textos/legendas alinhados a `sequencia_tipos`. */
  sequencia_textos: (string | null)[] | null
  /** URLs de mídia alinhadas a `sequencia_tipos`. */
  sequencia_midias: (string | null)[] | null
}

/** Item retornado por `GET /api/kanban/disparo_em_massa`. */
export type CampanhaListItem = Pick<
  CampanhaRow,
  | 'id'
  | 'nome'
  | 'tipo_mensagem'
  | 'conteudo_texto'
  | 'url_midia'
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
  | 'fonte_canal_id'
  | 'envia_para_grupo'
  | 'coluna_id'
  | 'funil_id'
  | 'timezone_escolhido'
  | 'tamanho_lote'
  | 'pausa_lote_minutos'
  | 'coluna_erro_id'
  | 'funil_erro_id'
  | 'sequencia_tipos'
  | 'sequencia_textos'
  | 'sequencia_midias'
>

/** Corpo de `PATCH /api/kanban/disparo_em_massa`. */
export type AtualizarCampanhaBody = Omit<CriarCampanhaBody, 'coluna_ids'> & {
  campanha_id: string
  /** Se informado, recalcula `total_contatos` com base nas colunas. */
  coluna_ids?: number[]
}

/**
 * Corpo parcial de `PATCH /api/kanban/disparo_em_massa` (somente agendamento).
 * Atualiza `proximo_disparo` ou `data_inicio` conforme o campo exibido no card.
 */
export type AtualizarAgendamentoCampanhaBody = {
  workspace_id: number
  campanha_id: string
  somente_agendamento: true
  /** Qual coluna atualizar. */
  campo_agendamento: 'proximo_disparo' | 'data_inicio'
  data_local: string
  hora_local: string
}

/** Resposta de `PATCH /api/kanban/disparo_em_massa`. */
export type AtualizarCampanhaResponse = {
  campanha: CampanhaListItem
}

/** Resposta de `GET /api/kanban/disparo_em_massa`. */
export type ListarCampanhasResponse = {
  campanhas: CampanhaListItem[]
}

/** Resposta de `DELETE /api/kanban/disparo_em_massa`. */
export type ExcluirCampanhaResponse = {
  ok: true
  id: string
}

/** Corpo de `PATCH /api/kanban/disparo_em_massa/status`. */
export type AlterarStatusCampanhaBody = {
  workspace_id: number
  campanha_id: string
  status: CampanhaStatusCriacao
}

/** Resposta de `PATCH /api/kanban/disparo_em_massa/status`. */
export type AlterarStatusCampanhaResponse = {
  campanha: CampanhaListItem
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
