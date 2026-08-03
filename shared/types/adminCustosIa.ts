/**
 * Linha de `public.view_custos_por_canal`.
 * Sem canal: `nome_canal` vem como "Custo Geral (Sem Canal)"; só linhas com `erro = false`.
 */
export interface CustoPorCanalRow {
  workspace_id: number
  /** Nome do workspace (enriquecido na API; pode ser null se não encontrado). */
  workspace_nome: string | null
  canal_id: number | null
  nome_canal: string
  custo_total_brl: number
  total_tokens_usados: number
  modelos_usados: string[]
  /** MIN(criado_em) — quando começou o uso neste agrupamento. */
  primeiro_uso_em: string | null
  /** MAX(criado_em) — gasto mais recente. */
  ultimo_uso_em: string | null
}

/** Resposta de `GET /api/admin/custos-da-ia`. */
export interface AdminCustosIaResponse {
  items: CustoPorCanalRow[]
}

/** Linha de erro em `public.custos_tokens_ia` (`erro = true`). */
export interface CustoTokenIaErroRow {
  workspace_id: string
  canal_id: string | null
  url_erro: string | null
}

/** Resposta de `GET /api/admin/custos-da-ia/erro`. */
export interface AdminCustosIaErroResponse {
  items: CustoTokenIaErroRow[]
}
