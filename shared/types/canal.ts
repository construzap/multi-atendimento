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
}

export type CanalProvedorPagamentos = 'pagar.me' | 'asaas'

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
  taxas_cartao: CanalTaxasCartao
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
  horarios?: CanalHorarios
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
  horarios?: CanalHorarios
  tem_inteligencia_artificial?: boolean
  url?: string | null
  model_name?: string | null
  /** Texto plano da API key — o servidor criptografa com pgp_sym_encrypt. */
  api_key?: string | null
}
