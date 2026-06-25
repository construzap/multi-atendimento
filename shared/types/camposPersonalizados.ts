export type TipoCampoPersonalizado = 'text' | 'number' | 'date' | 'boolean'

export interface CampoPersonalizado {
  id: number
  workspace_id: number
  nome: string
  tipo: TipoCampoPersonalizado
  created_at: string
}

export interface ValorCampoPersonalizado {
  id: number
  campo_id: number
  conversa_key: string
  valor: string | null
  updated_at: string
}

export interface CamposPersonalizadosListaResponse {
  data: CampoPersonalizado[]
}

export interface CampoPersonalizadoCriarResponse {
  data: CampoPersonalizado
}

export interface CampoPersonalizadoAtualizarResponse {
  data: CampoPersonalizado
}

export interface CampoPersonalizadoEliminarResponse {
  ok: true
}

export interface ValoresCamposPersonalizadosListaResponse {
  data: ValorCampoPersonalizado[]
}

export interface ValorCampoPersonalizadoSalvarResponse {
  data: ValorCampoPersonalizado
}

/** Valor de um campo personalizado junto com metadados do campo (para exibição). */
export interface ValorCampoPersonalizadoComCampo extends ValorCampoPersonalizado {
  campo: CampoPersonalizado
}
