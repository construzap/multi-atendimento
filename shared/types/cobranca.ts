/** Tipos da feature de cobrança (tabelas `cobranca` / `cobranca_produtos`). */

export type TipoCobranca = 'unico' | 'parcelado' | 'assinatura'
/** Frequência da assinatura (legado). */
export type FrequenciaRecorrencia = 'mensal' | 'semanal'
/** Periodicidade da cobrança/lembrete se o cliente não pagar (fiado). */
export type FrequenciaCobranca = 'diaria' | 'semanal' | 'mensal' | 'anual'
export type StatusContratoCobranca = 'ativo' | 'vencida' | 'finalizado' | 'cancelado'

export type CobrancaProdutoInput = {
  produto_nome: string
  quantidade: number
  preco_unitario: number
}

export type CriarCobrancaBody = {
  workspace_id: number
  canal_id: number
  conversa_key: string
  phone: string
  /** Nome do contato/conversa selecionado. */
  name?: string | null
  tipo_cobranca: TipoCobranca | 'fiado'
  valor_total: number
  total_parcelas?: number | null
  frequencia_recorrencia?: FrequenciaRecorrencia | null
  /** Como cobrar se não pagar (fiado): diaria | semanal | mensal | anual */
  frequencia_cobranca?: FrequenciaCobranca | null
  /** Data local da próxima notificação (AAAA-MM-DD), interpretada em `iana_timezone`. */
  data_proxima_local: string
  /** Hora local da próxima notificação (HH:mm), interpretada em `iana_timezone`. */
  hora_proxima_local: string
  /** Fuso IANA Brasil (ex.: America/Sao_Paulo). */
  iana_timezone: string
  data_fim?: string | null
  porcentagem_multa?: number | null
  porcentagem_juros_mes?: number | null
  template_mensagem: string
  /** Texto enviado quando a cobrança já está vencida. */
  template_mensagem_vencida: string
  produtos: CobrancaProdutoInput[]
}

export type CobrancaProduto = {
  id: number
  cobranca_id: number
  produto_nome: string
  quantidade: number
  preco_unitario: number
  preco_total: number
}

export type Cobranca = {
  id: number
  workspace_id: number
  canal_id: number
  conversa_key: string
  phone: string
  name: string | null
  tipo_cobranca: TipoCobranca
  valor_total: number
  status_contrato: StatusContratoCobranca
  total_parcelas: number | null
  frequencia_recorrencia: FrequenciaRecorrencia | null
  frequencia_cobranca: FrequenciaCobranca | null
  /** Instantâneo UTC da próxima notificação. */
  data_proxima_notificacao: string | null
  /** Fuso IANA usado ao definir a data/hora local. */
  iana_timezone: string | null
  /** Legado — preenchido a partir da data local. */
  dia_vencimento: number
  /** Legado — preenchido a partir da data local. */
  data_inicio: string
  data_fim: string | null
  porcentagem_multa: number | null
  porcentagem_juros_mes: number | null
  template_mensagem: string
  template_mensagem_vencida: string
  /** Instantâneo UTC do vencimento (definido na criação). */
  data_vencimento: string | null
  created_at: string
  updated_at: string | null
  /** Produtos — carregados sob demanda e cacheados em `items[].produtos`. */
  produtos?: CobrancaProduto[]
}

export type CriarCobrancaResponse = {
  cobranca: Cobranca
  produtos: CobrancaProduto[]
}

export type ListarCobrancasResponse = {
  data: Cobranca[]
}

export type ListarCobrancaProdutosResponse = {
  data: CobrancaProduto[]
  cobranca_id: number
}
