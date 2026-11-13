import { abrirLotePlanilha, processarLotePorCodigo, type ResumoLotePlanilha } from '../../../utils/produtoPlanilhaLote'

/**
 * POST /api/produtos/planilha/atualizar-por-codigo
 *
 * A planilha veio mapeada só com `codigo`.
 * Busca em `produtos_workspace` por esse código.
 * Se achar, atualiza e mantém nome e categoria. Se não achar, cria.
 */
export default defineEventHandler(async (event): Promise<ResumoLotePlanilha> => {
  const { admin, workspaceId, linhas } = await abrirLotePlanilha(event)
  return processarLotePorCodigo(event, admin, workspaceId, linhas)
})
