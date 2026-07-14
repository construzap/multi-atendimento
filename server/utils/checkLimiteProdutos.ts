import { serverSupabaseServiceRole } from '#supabase/server'
import { createError } from 'h3'
import type { H3Event } from 'h3'

export type CheckLimiteProdutosResult = {
  /** `null` = workspace sem limite configurado. */
  limite: number | null
  /** Produtos pai atuais no workspace (alinha com o total da listagem). */
  atual: number
  /** Vagas restantes; `null` quando não há limite. */
  restantes: number | null
}

/**
 * Conta produtos “pai” do workspace (`parent_id` null), mesmo critério do total na UI.
 */
async function contarProdutosPaiWorkspace(
  admin: ReturnType<typeof serverSupabaseServiceRole<any>>,
  workspaceId: number,
): Promise<number> {
  const { count, error } = await admin
    .from('produtos_workspace')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .is('parent_id', null)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }
  return typeof count === 'number' && Number.isFinite(count) ? count : 0
}

/**
 * Garante que o workspace ainda pode receber `quantidadeAInserir` produtos novos
 * face a `workspace.limite_produtos`.
 *
 * - `limite_produtos` null → sem limite (passa).
 * - Limite já atingido ou lote não cabe nas vagas → 403.
 *
 * @param quantidadeAInserir Quantidade de produtos pai a criar neste request (≥ 1).
 */
export async function checkLimiteProdutos(
  event: H3Event,
  workspaceId: number,
  quantidadeAInserir: number,
): Promise<CheckLimiteProdutosResult> {
  const qtd = Math.trunc(quantidadeAInserir)
  if (!Number.isFinite(qtd) || qtd < 1) {
    throw createError({
      statusCode: 400,
      statusMessage: 'quantidadeAInserir inválida para verificação de limite.',
    })
  }

  const admin = serverSupabaseServiceRole<any>(event)

  const { data: ws, error: wsErr } = await admin
    .from('workspace')
    .select('limite_produtos')
    .eq('id', workspaceId)
    .is('deleted_at', null)
    .is('deleted_by', null)
    .maybeSingle()

  if (wsErr) {
    throw createError({ statusCode: 500, statusMessage: wsErr.message })
  }
  if (!ws) {
    throw createError({ statusCode: 404, statusMessage: 'Workspace não encontrado.' })
  }

  const limRaw = (ws as { limite_produtos?: unknown }).limite_produtos
  const limite =
    limRaw == null || limRaw === ''
      ? null
      : typeof limRaw === 'number'
        ? Math.trunc(limRaw)
        : Number.parseInt(String(limRaw), 10)

  const atual = await contarProdutosPaiWorkspace(admin, workspaceId)

  if (limite == null || !Number.isFinite(limite) || limite < 0) {
    return { limite: null, atual, restantes: null }
  }

  const restantes = Math.max(0, limite - atual)

  if (atual >= limite) {
    throw createError({
      statusCode: 403,
      statusMessage: `Limite de produtos atingido (${limite}). Remova produtos ou aumente o limite do workspace.`,
    })
  }

  if (qtd > restantes) {
    throw createError({
      statusCode: 403,
      statusMessage:
        restantes === 1
          ? `Só é possível adicionar mais 1 produto (limite ${limite}; já existem ${atual}).`
          : `Só é possível adicionar mais ${restantes} produtos (limite ${limite}; já existem ${atual}).`,
    })
  }

  return { limite, atual, restantes }
}
