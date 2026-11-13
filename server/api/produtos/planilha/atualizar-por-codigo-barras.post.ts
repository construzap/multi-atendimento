import { abrirLotePlanilha, processarLotePorCodigoBarras, type ResumoLotePlanilha } from '../../../utils/produtoPlanilhaLote'

/**
 * POST /api/produtos/planilha/atualizar-por-codigo-barras
 *
 * A planilha veio mapeada só com código de barras.
 * Busca nome, foto e categoria na `tabelageral`, junta com a linha
 * e atualiza ou cria o produto do workspace.
 */
export default defineEventHandler(async (event): Promise<ResumoLotePlanilha> => {
  const { admin, workspaceId, linhas } = await abrirLotePlanilha(event)
  return processarLotePorCodigoBarras(event, admin, workspaceId, linhas)
})
