/** Canal do workspace para configuração de I.A no painel admin. */
export interface AdminCanalIa {
  id: number
  nome: string | null
  descricao: string | null
  provedor: number | null
  tem_inteligencia_artificial: boolean
  created_at: string
}

/** Limites de I.A do dono do workspace (`vw_perfil_consolidado`). */
export interface AdminPerfilIaLimites {
  user_id: string
  limite_ias: number | null
  ias_atreladas: number
}

export interface AdminCanalIaListResponse {
  items: AdminCanalIa[]
  perfil: AdminPerfilIaLimites
}

export interface AdminCanalIaAtualizarBody {
  workspace_id: number | string
  id: number | string
  tem_inteligencia_artificial: boolean
}

export interface AdminAtualizarLimiteIasBody {
  user_id: string
  limite_ias: number
}
