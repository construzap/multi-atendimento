export type CalendarEvent = {
  id: string
  title: string
  color?: 'primary' | 'info' | 'tertiary'
  /** Indica agendamento recorrente (ícone no calendário). */
  recorrente?: boolean | null
}

export type AgendamentoDiaItem = {
  id: number
  data_agendada: string
  /** Canal de envio (opcional em dados antigos / demo). */
  id_canal?: number | null
  /** Fuso IANA persistido (opcional em dados antigos). */
  iana_timezone?: string | null
  usuario_empresa_id: number | null
  mensagem_type: string | null
  mensagem_texto: string | null
  nomecliente: string | null
  telefone: string | null
  status: string | null
  midia_url: string | null
  recorrente?: boolean | null
  intervalo_recorrencia?: string | null
}

export type AgendamentoTipoForm = 'texto' | 'imagem' | 'audio'

export type DestinatarioModo = 'numeros' | 'contatos'

export type ContatoDestinoUi = {
  /** `conversas.key` (ou chave sintética ao editar agendamento antigo). */
  key: string
  nomecliente: string | null
  telefone: string | null
  photo?: string | null
}

/** `unico` = não recorrente; caso contrário, repetição a partir da data/hora do agendamento. */
export type AgendamentoRecorrenciaUi = 'unico' | 'diaria' | 'semanal' | 'mensal' | 'anual'

/** Payload apenas para UI — o pai decide persistência (não implementada nos componentes). */
export type CriarAgendamentoPayloadUi = {
  tipo: AgendamentoTipoForm
  mensagem: string
  dataIso: string
  hora: string
  /** Fuso IANA (Brasil) em que `dataIso` + `hora` foram escolhidos. */
  ianaTimezone: string
  /** Canal de envio (`canais.id`). */
  idCanal: number | null
  /** Recorrência: `unico` ou intervalo escolhido. */
  recorrencia: AgendamentoRecorrenciaUi
  destMode: DestinatarioModo
  manualNome: string
  manualTelefone: string
  contato: ContatoDestinoUi | null
  imagemNome: string | null
  audioNome: string | null
}
