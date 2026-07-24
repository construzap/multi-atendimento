import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { createError, getQuery } from 'h3'
import type {
  ProdutoOportunidadeVendaItem,
  ProdutoOportunidadeVendaOcorrencia,
  ProdutosOportunidadesVendasTotalResponse,
} from '#shared/types/produtos'
import { checkWorkspace } from '../../../utils/checkWorkspace'
import { getAuthUserId } from '../../../utils/getAuthUserId'

const SELECT_RECENTE =
  'workspace_id, canal_id, canal_nome, produto_sugerido, produto_chave, total_buscas, clientes_unicos, ultima_busca, ocorrencias'

function parsePositiveInt(raw: unknown, label: string): number {
  const s = String(raw ?? '').trim()
  if (!s) {
    throw createError({ statusCode: 400, statusMessage: `${label} é obrigatório.` })
  }
  const n = Number.parseInt(s, 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw createError({ statusCode: 400, statusMessage: `${label} inválido.` })
  }
  if (String(n) !== s) {
    throw createError({ statusCode: 400, statusMessage: `${label} inválido.` })
  }
  return n
}

function mapOcorrencia(raw: unknown): ProdutoOportunidadeVendaOcorrencia | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const idRaw = o.id
  const id =
    typeof idRaw === 'number'
      ? idRaw
      : Number.parseInt(String(idRaw ?? ''), 10)
  if (!Number.isFinite(id) || id < 1) return null
  return {
    id: Math.trunc(id),
    conversa_key: o.conversa_key == null ? null : String(o.conversa_key),
    phone: o.phone == null ? null : String(o.phone),
    contato_nome: o.contato_nome == null ? null : String(o.contato_nome),
    n8n_execution_url: o.n8n_execution_url == null ? null : String(o.n8n_execution_url),
    created_at: o.created_at == null ? null : String(o.created_at),
  }
}

function mapOcorrencias(raw: unknown): ProdutoOportunidadeVendaOcorrencia[] {
  if (!Array.isArray(raw)) return []
  const out: ProdutoOportunidadeVendaOcorrencia[] = []
  for (const item of raw) {
    const mapped = mapOcorrencia(item)
    if (mapped) out.push(mapped)
  }
  return out
}

function mapRow(r: Record<string, unknown>): ProdutoOportunidadeVendaItem {
  const workspace_id =
    typeof r.workspace_id === 'number' ? r.workspace_id : Number.parseInt(String(r.workspace_id ?? ''), 10)
  const canal_id =
    r.canal_id == null
      ? null
      : typeof r.canal_id === 'number'
        ? r.canal_id
        : Number.parseInt(String(r.canal_id), 10)
  const total_buscas =
    typeof r.total_buscas === 'number' ? r.total_buscas : Number.parseInt(String(r.total_buscas ?? '0'), 10)
  const clientes_unicos =
    typeof r.clientes_unicos === 'number'
      ? r.clientes_unicos
      : Number.parseInt(String(r.clientes_unicos ?? '0'), 10)

  return {
    workspace_id: Number.isFinite(workspace_id) ? workspace_id : 0,
    canal_id: canal_id != null && Number.isFinite(canal_id) ? canal_id : null,
    canal_nome: r.canal_nome == null ? null : String(r.canal_nome),
    produto_sugerido: String(r.produto_sugerido ?? '').trim(),
    produto_chave: String(r.produto_chave ?? '').trim(),
    total_buscas: Number.isFinite(total_buscas) ? total_buscas : 0,
    clientes_unicos: Number.isFinite(clientes_unicos) ? clientes_unicos : 0,
    ultima_busca: r.ultima_busca == null ? null : String(r.ultima_busca),
    ocorrencias: mapOcorrencias(r.ocorrencias),
  }
}

/**
 * GET /api/produtos/oportunidades-de-vendas/total?workspace_id=
 *
 * Conta linhas em `view_produtos_nao_encontrados` e devolve a com `ultima_busca` mais recente.
 */
export default defineEventHandler(async (event): Promise<ProdutosOportunidadesVendasTotalResponse> => {
  const client = await serverSupabaseClient(event)
  const { data: authData, error: authError } = await client.auth.getUser()

  if (authError || !authData.user) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const userId = getAuthUserId(authData.user)
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const q = getQuery(event)
  const workspaceId = parsePositiveInt(q.workspace_id, 'workspace_id')
  await checkWorkspace(event, workspaceId, userId)

  const admin = serverSupabaseServiceRole<any>(event)

  const [{ count, error: countError }, { data: recenteRows, error: recenteError }] = await Promise.all([
    admin
      .from('view_produtos_nao_encontrados')
      .select('produto_chave', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId),
    admin
      .from('view_produtos_nao_encontrados')
      .select(SELECT_RECENTE)
      .eq('workspace_id', workspaceId)
      .order('ultima_busca', { ascending: false, nullsFirst: false })
      .limit(1),
  ])

  if (countError) {
    throw createError({ statusCode: 500, statusMessage: countError.message })
  }
  if (recenteError) {
    throw createError({ statusCode: 500, statusMessage: recenteError.message })
  }

  const total = typeof count === 'number' && Number.isFinite(count) ? count : 0
  const first = Array.isArray(recenteRows) && recenteRows.length > 0 ? recenteRows[0] : null
  const mais_recente =
    first && typeof first === 'object' ? mapRow(first as Record<string, unknown>) : null

  return {
    total,
    mais_recente,
  }
})
