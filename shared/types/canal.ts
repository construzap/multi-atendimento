/** Horário de um dia da semana (coluna `horarios` jsonb em `canais`). */
export type CanalHorarioDia = {
  aberto: boolean
  inicio: string
  inicioAlmoco: string
  fimAlmoco: string
  fim: string
}

/** Dias exigidos pelo check `canais_horarios_formato_check`. */
export type CanalHorarioDiaKey =
  | 'segunda'
  | 'terca'
  | 'quarta'
  | 'quinta'
  | 'sexta'
  | 'sabado'
  | 'domingo'

export type CanalHorarios = Record<CanalHorarioDiaKey, CanalHorarioDia>

export const CANAL_HORARIO_DIAS: CanalHorarioDiaKey[] = [
  'domingo',
  'segunda',
  'terca',
  'quarta',
  'quinta',
  'sexta',
  'sabado',
]

/** Remonta o objeto na ordem do formulário (domingo → sábado). */
export function ordenarCanalHorarios(raw: CanalHorarios): CanalHorarios {
  const out = {} as CanalHorarios
  for (const dia of CANAL_HORARIO_DIAS) {
    out[dia] = raw[dia]
  }
  return out
}

/**
 * Tabela `public.canais` (Supabase) — projeção para listagem (sem token/servidor/api_key).
 */
export interface Canal {
  id: number
  nome: string | null
  descricao: string | null
  provedor: number | null
  created_at: string
  latitude: number | null
  longitude: number | null
  endereco: string | null
  tempo_aviso_minutos: number
  /** Valor mínimo do pedido (`canais.valor_pedido_minimo`; default 0). */
  valor_pedido_minimo: number
  horarios: CanalHorarios
  tem_inteligencia_artificial: boolean
  /** Endpoint OpenAI-compatible do agente (sem segredo). */
  url: string | null
  model_name: string | null
  /** Indica se há api_key_encrypted no banco (nunca envia a chave). */
  tem_api_key: boolean
  /**
   * Dados de pagamento (GET /api/canais/pagamento).
   * `undefined` = ainda não carregado no Pinia.
   */
  pagamento?: CanalPagamentoInfo
  /** Loja aberta/fechada (`canais.loja_aberta`; null no banco → true). */
  loja_aberta: boolean
  /**
   * Agenda pedido com loja fechada (`canais.agenda_pedido`; null → false).
   * Na UI só aparece o toggle quando `loja_aberta` é false.
   */
  agenda_pedido: boolean
  /** Assina a mensagem da I.A. (`canais.assinatura_ia_na_mensagem`). */
  assinatura_ia_na_mensagem: boolean
  /** Exibe botão para o cliente iniciar a I.A. (`canais.botao_para_iniciar_ia`). */
  botao_para_iniciar_ia: boolean
  /** Texto de saudação do canal (`canais.mensagem_saudacao`). */
  mensagem_saudacao: string | null
  /** URL da imagem de saudação (`canais.imagem_saudacao`). */
  imagem_saudacao: string | null
  /** Slug público da loja (`canais.loja_slug`). */
  loja_slug: string | null
  formas_pagamento: CanalFormasPagamento
  /** Disparo em massa ativo (`canais.disparo_ativo`). */
  disparo_ativo: boolean
  /** Passos de follow-up: `{ "1": { minutos_espera: 5 }, ... }`. */
  config_follow_up: CanalConfigFollowUp
}

export type CanalFormasPagamentoOnline = {
  pix: boolean
  boleto: boolean
  cartao_debito: boolean
  cartao_credito: boolean
}

export type CanalFormasPagamentoEntrega = {
  dinheiro: boolean
  cartao_debito: boolean
  vale_refeicao: boolean
  cartao_credito: boolean
}

export type CanalFormasPagamento = {
  online: CanalFormasPagamentoOnline
  entrega: CanalFormasPagamentoEntrega
}

export const CANAL_FORMAS_PAGAMENTO_PADRAO: CanalFormasPagamento = {
  online: {
    pix: true,
    boleto: false,
    cartao_debito: false,
    cartao_credito: false,
  },
  entrega: {
    dinheiro: true,
    cartao_debito: true,
    vale_refeicao: false,
    cartao_credito: true,
  },
}

export const CANAL_FORMAS_ONLINE: { key: keyof CanalFormasPagamentoOnline; label: string }[] = [
  { key: 'pix', label: 'PIX' },
  { key: 'boleto', label: 'Boleto' },
  { key: 'cartao_debito', label: 'Cartão de débito' },
  { key: 'cartao_credito', label: 'Cartão de crédito' },
]

export const CANAL_FORMAS_ENTREGA: { key: keyof CanalFormasPagamentoEntrega; label: string }[] = [
  { key: 'dinheiro', label: 'Dinheiro' },
  { key: 'cartao_debito', label: 'Cartão de débito' },
  { key: 'cartao_credito', label: 'Cartão de crédito' },
  { key: 'vale_refeicao', label: 'Vale-refeição' },
]

/** Um passo de follow-up (`config_follow_up`). */
export type CanalFollowUpPasso = {
  minutos_espera: number
}

export type CanalConfigFollowUp = Record<string, CanalFollowUpPasso>

export type CanalProvedorPagamentos = 'pagar.me' | 'asaas' | 'pix_manual'

/** Tipo da chave PIX (`canais.pixtype`) — usado no PIX Manual. */
export type CanalPixType = 'CPF' | 'CNPJ' | 'PHONE' | 'EMAIL' | 'EVP'

export const CANAL_PIX_TYPES: { value: CanalPixType; label: string }[] = [
  { value: 'CPF', label: 'CPF' },
  { value: 'CNPJ', label: 'CNPJ' },
  { value: 'PHONE', label: 'Telefone' },
  { value: 'EMAIL', label: 'E-mail' },
  { value: 'EVP', label: 'Chave aleatória (EVP)' },
]

/** Taxas por parcela — chaves livres (`1x`, `2x`, `12x`, …). */
export type CanalTaxasCartao = Record<string, number>

export const CANAL_TAXAS_CARTAO_PADRAO: CanalTaxasCartao = {
  '1x': 0,
  '2x': 0,
  '3x': 0,
  '4x': 0,
  '5x': 0,
  '6x': 0,
}

/** Projeção pública de pagamento do canal (sem ciphertext). */
export type CanalPagamentoInfo = {
  canal_id: number
  workspace_id: number
  provedor_pagamentos: CanalProvedorPagamentos | null
  chave_pix: string | null
  /** Indica se há credenciais_encrypted no banco. */
  tem_credenciais_pagarme: boolean
  /** null = sem taxas cadastradas. */
  taxas_cartao: CanalTaxasCartao | null
  /** Mensagem exibida no PIX Manual (`canais.mensagem_pix_manual`). */
  mensagem_pix_manual: string | null
  /** Tipo da chave PIX (`canais.pixtype`) — PIX Manual. */
  pixtype: CanalPixType | null
}

/** Payload de criação de canal (POST /api/canais/criarcanal). */
export type CanalCreateInput = {
  nome: string
  descricao?: string | null
  workspace_id: number
  endereco?: string | null
  latitude?: number | null
  longitude?: number | null
  tempo_aviso_minutos?: number
  valor_pedido_minimo?: number
  horarios?: CanalHorarios
  assinatura_ia_na_mensagem?: boolean
  botao_para_iniciar_ia?: boolean
  mensagem_saudacao?: string | null
  imagem_saudacao?: string | null
  loja_slug?: string | null
  formas_pagamento?: CanalFormasPagamento
  disparo_ativo?: boolean
  config_follow_up?: CanalConfigFollowUp
}

/** Payload de atualização de canal (POST /api/canais/editarcanal). */
export type CanalUpdateInput = {
  id_canal: number
  workspace_id: number
  nome?: string
  descricao?: string | null
  endereco?: string | null
  latitude?: number | null
  longitude?: number | null
  tempo_aviso_minutos?: number
  valor_pedido_minimo?: number
  horarios?: CanalHorarios
  tem_inteligencia_artificial?: boolean
  url?: string | null
  model_name?: string | null
  /** Texto plano da API key — o servidor criptografa com pgp_sym_encrypt. */
  api_key?: string | null
  loja_aberta?: boolean
  agenda_pedido?: boolean
  assinatura_ia_na_mensagem?: boolean
  botao_para_iniciar_ia?: boolean
  mensagem_saudacao?: string | null
  imagem_saudacao?: string | null
  loja_slug?: string | null
  formas_pagamento?: CanalFormasPagamento
  disparo_ativo?: boolean
  config_follow_up?: CanalConfigFollowUp
}
