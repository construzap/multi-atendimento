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
 * Tabela `public.canais` (Supabase) — projeção para listagem (sem token/servidor).
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
}

/** Payload de criação de canal (POST /api/canais/criarcanal). */
export type CanalCreateInput = {
  nome: string
  descricao?: string | null
  workspace_id: number
  endereco: string
  latitude: number
  longitude: number
  tempo_aviso_minutos: number
  horarios: CanalHorarios
}

/** Payload de atualização de canal (POST /api/canais/editarcanal). */
export type CanalUpdateInput = {
  id_canal: number
  workspace_id: number
  nome: string
  descricao?: string | null
  endereco: string
  latitude: number
  longitude: number
  tempo_aviso_minutos: number
  horarios: CanalHorarios
}
