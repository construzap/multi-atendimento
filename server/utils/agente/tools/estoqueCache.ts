import type { H3Event } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { OpenAiChatMessage } from '../memory'

const DB_FETCH_LIMIT = 120

/** Normaliza texto de produto para comparação de cache. */
export function normalizeProdutoQuery(raw: string): string {
  return String(raw ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Remove quantidade inicial para match mais flexível ("2 brahma" ≈ "brahma"). */
export function stripLeadingQuantity(raw: string): string {
  return normalizeProdutoQuery(raw)
    .replace(/^\d+([.,]\d+)?\s+/, '')
    .replace(/^(meio|meia|um|uma|dois|duas|tres|três|quatro|cinco|seis|sete|oito|nove|dez)\s+/, '')
    .trim()
}

export function produtoQueriesMatch(a: string, b: string): boolean {
  const na = normalizeProdutoQuery(a)
  const nb = normalizeProdutoQuery(b)
  if (!na || !nb) return false
  if (na === nb) return true

  const sa = stripLeadingQuantity(a)
  const sb = stripLeadingQuantity(b)
  if (!sa || !sb) return false
  if (sa === sb) return true

  // Um contém o outro (após strip), com mínimo de 3 chars para evitar falso positivo.
  if (sa.length >= 3 && sb.length >= 3) {
    if (sa.includes(sb) || sb.includes(sa)) return true
  }
  return false
}

function parseEstoqueProdutosArg(rawArgs: string): string {
  try {
    const parsed = JSON.parse(rawArgs || '{}') as Record<string, unknown>
    const v = parsed.produtos_ ?? parsed['produtos '] ?? parsed.produtos
    if (v == null) return ''
    return typeof v === 'string' ? v : String(v)
  } catch {
    return ''
  }
}

/**
 * Procura no histórico (mais recente primeiro) um resultado de <estoque>
 * cujo produtos_ case com a query atual. Retorna o content da tool ou null.
 */
export function findEstoqueInMessages(
  messages: OpenAiChatMessage[],
  produtosQuery: string,
): string | null {
  const q = normalizeProdutoQuery(produtosQuery)
  if (!q || messages.length === 0) return null

  const toolByCallId = new Map<string, string>()
  for (const msg of messages) {
    if (msg.role !== 'tool') continue
    if ((msg.name ?? '') !== 'estoque') continue
    const id = msg.tool_call_id
    const content = (msg.content ?? '').trim()
    if (id && content) toolByCallId.set(id, content)
  }

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]!
    if (msg.role !== 'assistant' || !msg.tool_calls?.length) continue

    for (const call of msg.tool_calls) {
      if ((call.function?.name ?? '') !== 'estoque') continue
      const callProdutos = parseEstoqueProdutosArg(call.function?.arguments ?? '{}')
      if (!produtoQueriesMatch(callProdutos, produtosQuery)) continue

      const cached = toolByCallId.get(call.id)
      if (cached) return cached
    }
  }

  return null
}

type DbRow = {
  role: string
  message: string | null
  tool_calls: unknown
  tool_call_id: string | null
  name: string | null
}

function dbRowsToMessages(rows: DbRow[]): OpenAiChatMessage[] {
  const out: OpenAiChatMessage[] = []
  for (const row of rows) {
    if (row.role === 'assistant' && row.tool_calls != null) {
      out.push({
        role: 'assistant',
        content: row.message,
        tool_calls: row.tool_calls as OpenAiChatMessage['tool_calls'],
      })
      continue
    }
    if (row.role === 'tool' && (row.name ?? '') === 'estoque') {
      out.push({
        role: 'tool',
        content: row.message,
        tool_call_id: row.tool_call_id ?? undefined,
        name: 'estoque',
      })
    }
  }
  return out
}

/** Busca no banco resultados recentes de estoque da sessão (fallback do histórico em memória). */
export async function findEstoqueInDb(
  event: H3Event,
  sessionId: string,
  produtosQuery: string,
): Promise<string | null> {
  const q = normalizeProdutoQuery(produtosQuery)
  if (!q || !sessionId) return null

  const admin = serverSupabaseServiceRole<any>(event)
  const { data, error } = await admin
    .from('chat_messages_agente')
    .select('role, message, tool_calls, tool_call_id, name, created_at, id')
    .eq('session_id', sessionId)
    .in('role', ['assistant', 'tool'])
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(DB_FETCH_LIMIT)

  if (error || !data?.length) return null

  // rows vêm do mais novo → mais antigo; invertemos para ordem cronológica
  const chronological = [...(data as DbRow[])].reverse()
  return findEstoqueInMessages(dbRowsToMessages(chronological), produtosQuery)
}

/**
 * Cache silencioso: tenta histórico do turno e, se precisar, o banco.
 * Retorna o mesmo formato de resposta da tool (sem mencionar cache).
 */
export async function resolveEstoqueCache(
  event: H3Event,
  params: {
    sessionId: string
    produtosQuery: string
    conversationMessages?: OpenAiChatMessage[]
  },
): Promise<string | null> {
  const query = params.produtosQuery.trim()
  if (!query) return null

  const fromMemory = findEstoqueInMessages(params.conversationMessages ?? [], query)
  if (fromMemory) return fromMemory

  return findEstoqueInDb(event, params.sessionId, query)
}
