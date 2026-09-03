import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError } from 'h3'
import type { AdminCustosIaResponse, CustoPorCanalRow } from '#shared/types/adminCustosIa'
import { checkAdmin } from '../../../utils/checkAdmin'
import { getAuthUserId } from '../../../utils/getAuthUserId'

function parseNum(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  const n = typeof raw === 'number' ? raw : Number.parseFloat(String(raw))
  return Number.isFinite(n) ? n : null
}

function parseIntOrNull(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10)
  return Number.isFinite(n) && Number.isInteger(n) ? n : null
}

function mapRow(
  r: Record<string, unknown>,
  workspaceNomeById: Map<number, string>,
): CustoPorCanalRow | null {
  const workspaceId = parseIntOrNull(r.workspace_id)
  if (workspaceId == null || workspaceId < 1) return null

  const canalId = parseIntOrNull(r.canal_id)
  const custo = parseNum(r.custo_total_brl) ?? 0
  const tokens = parseIntOrNull(r.total_tokens_usados) ?? 0
  const palavras = parseIntOrNull(r.total_palavras) ?? 0
  const letras = parseIntOrNull(r.total_letras) ?? 0
  const mensagens = parseIntOrNull(r.total_mensagens) ?? 0
  const custoPorLetra = parseNum(r.custo_por_letra) ?? 0
  const custoPorMensagem = parseNum(r.custo_por_mensagem) ?? 0

  const modelosRaw = r.modelos_usados
  const modelos = Array.isArray(modelosRaw)
    ? modelosRaw.map((m) => String(m ?? '').trim()).filter(Boolean)
    : []

  const nomeCanalRaw = r.nome_canal
  const nomeCanal =
    nomeCanalRaw == null || String(nomeCanalRaw).trim() === ''
      ? 'Custo Geral (Sem Canal)'
      : String(nomeCanalRaw).trim()

  const primeiroUso =
    r.primeiro_uso_em == null || String(r.primeiro_uso_em).trim() === ''
      ? null
      : String(r.primeiro_uso_em)
  const ultimoUso =
    r.ultimo_uso_em == null || String(r.ultimo_uso_em).trim() === ''
      ? null
      : String(r.ultimo_uso_em)

  return {
    workspace_id: workspaceId,
    workspace_nome: workspaceNomeById.get(workspaceId) ?? null,
    canal_id: canalId,
    nome_canal: nomeCanal,
    custo_total_brl: custo,
    total_tokens_usados: tokens,
    total_palavras: palavras,
    total_letras: letras,
    total_mensagens: mensagens,
    custo_por_letra: custoPorLetra,
    custo_por_mensagem: custoPorMensagem,
    modelos_usados: modelos,
    primeiro_uso_em: primeiroUso,
    ultimo_uso_em: ultimoUso,
  }
}

/**
 * GET /api/admin/custos-da-ia
 * Lista custos agregados por canal (`view_custos_por_canal`), somente admin.
 */
export default defineEventHandler(async (event): Promise<AdminCustosIaResponse> => {
  assertMethod(event, 'GET')

  const client = await serverSupabaseClient(event)
  const { data: authData, error: authError } = await client.auth.getUser()

  if (authError || !authData.user) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const userId = getAuthUserId(authData.user)
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  await checkAdmin(event, userId)

  const admin = serverSupabaseServiceRole<any>(event)

  const { data, error } = await admin
    .from('view_custos_por_canal')
    .select(
      'workspace_id, canal_id, nome_canal, custo_total_brl, total_tokens_usados, total_palavras, total_letras, total_mensagens, custo_por_letra, custo_por_mensagem, modelos_usados, primeiro_uso_em, ultimo_uso_em',
    )

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const rows = (data ?? []) as Record<string, unknown>[]
  const workspaceIds = [
    ...new Set(
      rows
        .map((r) => parseIntOrNull(r.workspace_id))
        .filter((id): id is number => id != null && id >= 1),
    ),
  ]

  const workspaceNomeById = new Map<number, string>()
  if (workspaceIds.length > 0) {
    const { data: wsRows, error: wsErr } = await admin
      .from('workspace')
      .select('id, nome')
      .in('id', workspaceIds)

    if (wsErr) {
      throw createError({ statusCode: 500, statusMessage: wsErr.message })
    }

    for (const w of wsRows ?? []) {
      const wr = w as Record<string, unknown>
      const id = parseIntOrNull(wr.id)
      if (id == null) continue
      workspaceNomeById.set(id, String(wr.nome ?? '').trim() || `Workspace #${id}`)
    }
  }

  const items = rows
    .map((r) => mapRow(r, workspaceNomeById))
    .filter((r): r is CustoPorCanalRow => r != null)
    .sort((a, b) => b.custo_total_brl - a.custo_total_brl)

  return { items }
})
