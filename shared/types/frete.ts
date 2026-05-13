/** Linha de `public.frete_config_workspace`. */
export type FreteConfigWorkspace = {
  id: number
  workspace_id: number
  capacidade_caminhao_kg: number
  created_at: string
  updated_at: string
}

/** Resposta de GET /api/frete/config — só `id` e capacidade (ou `null` se não existir config). */
export type FreteConfigCapacidadeResumo = {
  id: number | null
  capacidade_caminhao_kg: number | null
}

/** Linha de `public.frete_bairro_workspace` (resposta típica do POST). */
export type FreteBairroWorkspace = {
  id: number
  workspace_id: number
  bairro: string
  valor_frete: number | null
  frete_gratis: boolean
  ativo: boolean
  created_at: string
}

/**
 * Item da listagem GET /api/frete/bairros.
 * Inclui `id` para chave no Vue; o restante é o que a UI exibe (bairro, valor, grátis).
 */
export type FreteBairroListaItem = {
  id: number
  bairro: string
  valor_frete: number | null
  frete_gratis: boolean
}

/** Corpo de GET /api/frete/bairros */
export type FreteBairrosListaResponse = {
  data: FreteBairroListaItem[]
}

/** Corpo de PATCH /api/frete/bairro — atualiza linha existente (`id` + `workspace_id` obrigatórios). */
export type FreteBairroAtualizarBody = {
  id: number
  workspace_id: number
  /** Se omitido, mantém o nome atual. */
  bairro?: string
  /** Obrigatório quando `frete_gratis` é `false` e a linha ainda não tem valor. */
  valor_frete?: string | number | null
  /** Se omitido, mantém o flag atual. */
  frete_gratis?: boolean
}
