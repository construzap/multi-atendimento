import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, getQuery } from 'h3'
import type {
  AdminCustosIaPorCanalResponse,
  AdminCustosIaPorCanalTotais,
} from '#shared/types/adminCustosIa'
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

function parseDataYmd(raw: unknown): string | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null
  return s
}

/** Início inclusive do dia `inicioYmd` e fim exclusivo (dia seguinte a `fimYmd`), America/Sao_Paulo. */
function rangePeriodoBrasil(inicioYmd: string, fimYmd: string): { startIso: string; endIso: string } {
  const start = new Date(`${inicioYmd}T00:00:00.000-03:00`)
  const [y, m, d] = fimYmd.split('-').map(Number)
  const next = new Date(Date.UTC(y, m - 1, d + 1))
  const endYmd = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`
  const end = new Date(`${endYmd}T00:00:00.000-03:00`)
  return { startIso: start.toISOString(), endIso: end.toISOString() }
}

function comMedias(base: Omit<AdminCustosIaPorCanalTotais, 'custo_por_letra' | 'custo_por_mensagem'>): AdminCustosIaPorCanalTotais {
  return {
    ...base,
    custo_por_letra: base.total_letras > 0 ? base.custo_brl / base.total_letras : 0,
    custo_por_mensagem: base.total_mensagens > 0 ? base.custo_brl / base.total_mensagens : 0,
  }
}

function pickSum(row: Record<string, unknown>, col: string): number {
  const v = row[col]
  if (v != null && typeof v === 'object' && 'sum' in (v as object)) {
    return parseNum((v as { sum: unknown }).sum) ?? 0
  }
  return parseNum(v) ?? 0
}

function parseSomas(raw: unknown): Pick<
  AdminCustosIaPorCanalTotais,
  'custo_brl' | 'total_tokens' | 'total_palavras' | 'total_letras'
> {
  const row = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown> | null
  if (!row) {
    return { custo_brl: 0, total_tokens: 0, total_palavras: 0, total_letras: 0 }
  }
  return {
    custo_brl: pickSum(row, 'custo_brl'),
    total_tokens: Math.round(pickSum(row, 'total_tokens')),
    total_palavras: Math.round(pickSum(row, 'quantidade_palavras')),
    total_letras: Math.round(pickSum(row, 'quantidade_letras')),
  }
}

function aplicarCanalEPeriodo(
  query: any,
  canalId: number | null,
  periodo: { startIso: string; endIso: string } | null,
) {
  query = query.eq('erro', false)
  query = canalId == null ? query.is('canal_id', null) : query.eq('canal_id', String(canalId))
  if (periodo) {
    query = query.gte('criado_em', periodo.startIso).lt('criado_em', periodo.endIso)
  }
  return query
}

/**
 * GET /api/admin/custos-da-ia/por-canal?canal_id=
 * Totais do canal (gasto, letras, mensagens e médias). Sem filtro de `criado_em` por padrão.
 * Com `data_inicio` e `data_final` (YYYY-MM-DD): totais só daquele período.
 */
export default defineEventHandler(async (event): Promise<AdminCustosIaPorCanalResponse> => {
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

  const q = getQuery(event)
  const canalRaw = String(q.canal_id ?? '').trim()
  const semCanal = canalRaw === '' || canalRaw === 'sem-canal' || canalRaw === 'null'
  const canalId = semCanal ? null : parseIntOrNull(canalRaw)
  if (!semCanal && (canalId == null || canalId < 1)) {
    throw createError({ statusCode: 400, statusMessage: 'canal_id inválido' })
  }

  const dataInicio = parseDataYmd(q.data_inicio)
  const dataFinal = parseDataYmd(q.data_final)
  const temPeriodo = Boolean(dataInicio && dataFinal)

  if ((dataInicio && !dataFinal) || (!dataInicio && dataFinal)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Informe data_inicio e data_final juntas',
    })
  }

  if (temPeriodo && dataInicio! > dataFinal!) {
    throw createError({
      statusCode: 400,
      statusMessage: 'data_inicio deve ser anterior ou igual a data_final',
    })
  }

  const periodo = temPeriodo ? rangePeriodoBrasil(dataInicio!, dataFinal!) : null
  const admin = serverSupabaseServiceRole<any>(event)

  const aggQuery = aplicarCanalEPeriodo(
    admin.from('custos_tokens_ia').select(
      'custo_brl.sum(), total_tokens.sum(), quantidade_palavras.sum(), quantidade_letras.sum()',
    ),
    canalId,
    periodo,
  )

  const countQuery = aplicarCanalEPeriodo(
    admin.from('custos_tokens_ia').select('id', { count: 'exact', head: true }),
    canalId,
    periodo,
  )

  const [aggResult, countResult] = await Promise.all([aggQuery, countQuery])

  let somas = {
    custo_brl: 0,
    total_tokens: 0,
    total_palavras: 0,
    total_letras: 0,
  }
  let totalMensagens = countResult.count ?? 0

  if (countResult.error) {
    throw createError({ statusCode: 500, statusMessage: countResult.error.message })
  }

  if (!aggResult.error) {
    somas = parseSomas(aggResult.data)
  } else {
    const fallbackQuery = aplicarCanalEPeriodo(
      admin
        .from('custos_tokens_ia')
        .select('custo_brl, total_tokens, quantidade_palavras, quantidade_letras'),
      canalId,
      periodo,
    ).limit(10000)

    const { data: fallbackRows, error: fallbackErr } = await fallbackQuery
    if (fallbackErr) {
      throw createError({ statusCode: 500, statusMessage: aggResult.error.message })
    }

    somas = (fallbackRows ?? []).reduce(
      (acc, row) => {
        const r = row as Record<string, unknown>
        acc.custo_brl += parseNum(r.custo_brl) ?? 0
        acc.total_tokens += parseIntOrNull(r.total_tokens) ?? 0
        acc.total_palavras += parseIntOrNull(r.quantidade_palavras) ?? 0
        acc.total_letras += parseIntOrNull(r.quantidade_letras) ?? 0
        return acc
      },
      { custo_brl: 0, total_tokens: 0, total_palavras: 0, total_letras: 0 },
    )
    if (totalMensagens === 0) totalMensagens = fallbackRows?.length ?? 0
  }

  const totais = comMedias({
    ...somas,
    total_mensagens: totalMensagens,
  })

  let workspaceId: number | null = null
  let workspaceNome: string | null = null
  let nomeCanal = 'Custo Geral (Sem Canal)'

  if (canalId != null) {
    const { data: canalRow, error: canalErr } = await admin
      .from('canais')
      .select('id, nome, workspace_id')
      .eq('id', canalId)
      .maybeSingle()

    if (canalErr) {
      throw createError({ statusCode: 500, statusMessage: canalErr.message })
    }

    const cr = (canalRow ?? null) as Record<string, unknown> | null
    const nomeRaw = cr?.nome
    nomeCanal =
      nomeRaw == null || String(nomeRaw).trim() === ''
        ? `Canal #${canalId}`
        : String(nomeRaw).trim()

    workspaceId = parseIntOrNull(cr?.workspace_id)
    if (workspaceId != null) {
      const { data: wsRow, error: wsErr } = await admin
        .from('workspace')
        .select('id, nome')
        .eq('id', workspaceId)
        .maybeSingle()

      if (wsErr) {
        throw createError({ statusCode: 500, statusMessage: wsErr.message })
      }

      if (wsRow) {
        const wr = wsRow as Record<string, unknown>
        workspaceNome = String(wr.nome ?? '').trim() || `Workspace #${workspaceId}`
      }
    }
  }

  return {
    workspace_id: workspaceId,
    workspace_nome: workspaceNome,
    canal_id: canalId,
    nome_canal: nomeCanal,
    data_inicio: temPeriodo ? dataInicio : null,
    data_final: temPeriodo ? dataFinal : null,
    totais,
  }
})
