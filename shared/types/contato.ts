import type { TipoCampoPersonalizado } from './camposPersonalizados'

/** Campo personalizado embutido na view `view_kanban_conversas`. */
export type ContatoCampoPersonalizadoResumo = {
  id: number
  nome: string
  tipo: TipoCampoPersonalizado
  valor: string | null
}

/** Status no funil (`conversas.coluna_id` / `funil_id` via `view_kanban_conversas`). */
export type ContatoStatusFunil = {
  coluna_id: number
  coluna_nome: string | null
  coluna_cor: string | null
  funil_id: number | null
  atendente_id: string | null
  prioridade: number | null
  posicao: number | null
}

export type Contato = {
  key: string
  name: string | null
  created_at: string | null
  updated_at: string | null
  id_canal: number | null
  phone: string | null
  lid: string | null
  connect_phone: string | null
  photo: string | null
  workspace_id: number | null
  latitude: number | null
  longitude: number | null
  conversa_aberta: boolean | null
  is_group: boolean | null
  name_group: string | null
  ia_ligada: boolean | null
  nao_lidas: number
  campos_personalizados: ContatoCampoPersonalizadoResumo[]
  status_funil: ContatoStatusFunil | null
}

/** Campos do contato disponíveis para mapeamento na importação (exceto `key` e embutidos da view). */
export type CampoImportacaoContatoId = keyof Omit<
  Contato,
  'key' | 'campos_personalizados' | 'status_funil'
>

export type CampoContatoSistema = {
  id: CampoImportacaoContatoId | (string & {})
  label: string
  /** Pelo menos uma coluna do arquivo deve mapear para este campo. */
  obrigatorio?: boolean
}

export type ContatosListResponse = {
  data: Contato[]
  page: number
  perPage: number
  total: number
}

/** Campos editáveis na tabela de contatos (`PATCH /api/contatos/atualizar`). */
export type ContatoPatch = Partial<
  Pick<
    Contato,
    | 'name'
    | 'phone'
    | 'photo'
    | 'conversa_aberta'
    | 'is_group'
    | 'name_group'
    | 'ia_ligada'
    | 'id_canal'
  >
>

export type ContatoAtualizarResponse = {
  data: Contato
}

export type ContatoImportarCampoPersonalizado = {
  campo_id: number
  valor: unknown
}

export type ContatoImportarStatusFunil = {
  coluna_id: number
  atendente_id?: string | null
}

/** Linha enviada a `POST /api/contatos/importar`. */
export type ContatoImportarLinha = {
  phone: string
  id_canal: number
  name: string
  lid?: string | null
  photo?: string | null
  created_at?: string | null
  conversa_aberta?: boolean | null
  name_group?: string | null
  ia_ligada?: boolean | null
  latitude?: number | null
  longitude?: number | null
  campos_personalizados?: ContatoImportarCampoPersonalizado[]
  status_funil?: ContatoImportarStatusFunil
}

export type ContatosImportarLoteResponse = {
  inseridos: number
  atualizados: number
  campos_personalizados_gravados: number
  status_funil_gravados: number
}
