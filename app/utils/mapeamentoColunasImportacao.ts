export type CampoMapeamentoColuna = {
  id: string
  label: string
  /** Texto auxiliar (ex.: IDs disponíveis no workspace). */
  descricao?: string
}

/** IDs de mapeamento para `status_funil` na importação de contatos. */
export const MAPEAMENTO_FUNIL_COLUNA_ID = 'funil:coluna_id'
export const MAPEAMENTO_FUNIL_ATENDENTE_ID = 'funil:atendente_id'

export function mapeamentoTemCampo(
  mapeamentoPorIndice: Record<number, string>,
  campoId: string,
): boolean {
  return Object.values(mapeamentoPorIndice).some((v) => v === campoId)
}

export function mapeamentoTemCamposObrigatorios(
  mapeamentoPorIndice: Record<number, string>,
  camposObrigatorios: string[],
): boolean {
  if (!camposObrigatorios.length) return true
  return camposObrigatorios.every((c) => mapeamentoTemCampo(mapeamentoPorIndice, c))
}
