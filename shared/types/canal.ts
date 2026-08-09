/** Horário de um dia da semana (coluna `horarios` jsonb em `canais`). */
export type CanalHorarioDia = {
  aberto: boolean
  inicio: string
  inicioAlmoco: string
  fimAlmoco: string
  fim: string
}

export type CanalHorarios = {
  semana: CanalHorarioDia
  sabado: CanalHorarioDia
  domingo: CanalHorarioDia
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
