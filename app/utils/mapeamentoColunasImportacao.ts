export type CampoMapeamentoColuna = {
  id: string
  label: string
  /** Texto auxiliar (ex.: IDs disponíveis no workspace). */
  descricao?: string
  /** Texto integral exibido no tooltip quando `descricao` está resumida. */
  descricaoCompleta?: string
}

/** Resume uma lista para exibição; inclui texto completo quando há truncamento. */
export function resumirListaDescricao(
  textos: string[],
  max = 4,
): { descricao: string; descricaoCompleta?: string } {
  if (!textos.length) return { descricao: '' }
  const completo = textos.join(' · ')
  if (textos.length <= max) return { descricao: completo }
  return {
    descricao: `${textos.slice(0, max).join(' · ')} · +${textos.length - max}`,
    descricaoCompleta: completo,
  }
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
