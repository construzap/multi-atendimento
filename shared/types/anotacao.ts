/**
 * Tabela `public.anotacoes` — anotações internas da conversa.
 */
export type AnotacaoTipo = 'texto' | 'audio' | 'imagem' | 'video' | 'documento'

export interface Anotacao {
  id: number
  conversa_key: string
  workspace_id: number
  canal_id: number
  tipo_anotacao: AnotacaoTipo
  anotacao_text: string
  media_url: string | null
  created_at: string | null
  updated_at: string | null
}

/** Meta de paginação gravada no Pinia junto com a lista. */
export type AnotacoesMeta = {
  perPage: number
  total: number
}

export const ANOTACOES_PER_PAGE = 5

export interface AnotacoesListResponse {
  data: Anotacao[]
  offset: number
  perPage: number
  total: number
}

export interface AnotacaoCriarBody {
  workspace_id: number
  canal_id: number
  conversa_key: string
  tipo_anotacao: AnotacaoTipo
  anotacao_text: string
  media_url?: string | null
}

export interface AnotacaoMidiaUploadResponse {
  ok: true
  url: string
  key: string
  filename: string | null
  mime: string
  tipo_anotacao: Exclude<AnotacaoTipo, 'texto'>
  size: number
}
