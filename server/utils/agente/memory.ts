import { createError } from 'h3'
import type { H3Event } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { AgenteContext } from '#shared/types/agente'

export type OpenAiChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content?: string | null
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: { name: string; arguments: string }
  }>
  tool_call_id?: string
  name?: string
}

export function buildAgenteSessionId(workspaceId: number, conversaKey: string): string {
  return `${workspaceId}-${conversaKey}`
}

type DbRow = {
  role: string
  message: string | null
  tool_calls: unknown
  tool_call_id: string | null
  name: string | null
}

function rowToMessage(row: DbRow): OpenAiChatMessage | null {
  const role = row.role as OpenAiChatMessage['role']
  if (!['user', 'assistant', 'tool', 'system'].includes(role)) return null

  // DB: message | OpenAI API: content
  const msg: OpenAiChatMessage = { role, content: row.message }

  if (row.tool_calls != null) {
    msg.tool_calls = row.tool_calls as OpenAiChatMessage['tool_calls']
  }
  if (row.tool_call_id) msg.tool_call_id = row.tool_call_id
  if (row.name) msg.name = row.name

  return msg
}

/**
 * Garante sequência válida para a OpenAI:
 * mensagens `tool` só após `assistant` com `tool_calls` correspondente.
 * Evita 502: "messages with role 'tool' must be a response to a preceding message with 'tool_calls'".
 */
export function sanitizeAgenteHistory(messages: OpenAiChatMessage[]): OpenAiChatMessage[] {
  const out: OpenAiChatMessage[] = []
  let pendingIds: Set<string> | null = null

  const dropIncompleteToolBlock = () => {
    if (!pendingIds || pendingIds.size === 0) {
      pendingIds = null
      return
    }
    while (out.length > 0) {
      const last = out[out.length - 1]!
      if (last.role === 'tool') {
        out.pop()
        continue
      }
      if (last.role === 'assistant' && last.tool_calls?.length) {
        out.pop()
      }
      break
    }
    pendingIds = null
  }

  for (const msg of messages) {
    if (msg.role === 'system') continue

    if (msg.role === 'tool') {
      const id = msg.tool_call_id
      if (!pendingIds || !id || !pendingIds.has(id)) {
        // órfã (janela cortou o assistant com tool_calls)
        continue
      }
      out.push(msg)
      pendingIds.delete(id)
      if (pendingIds.size === 0) pendingIds = null
      continue
    }

    if (pendingIds && pendingIds.size > 0) {
      dropIncompleteToolBlock()
    }

    if (msg.role === 'assistant' && msg.tool_calls?.length) {
      out.push(msg)
      pendingIds = new Set(msg.tool_calls.map((t) => t.id).filter(Boolean))
      continue
    }

    out.push(msg)
  }

  dropIncompleteToolBlock()
  return out
}

/** Carrega as últimas `limit` mensagens da sessão (ordem cronológica, sanitizadas). */
export async function loadAgenteHistory(
  event: H3Event,
  sessionId: string,
  limit: number,
): Promise<OpenAiChatMessage[]> {
  const admin = serverSupabaseServiceRole<any>(event)
  const safeLimit = Math.max(1, limit)
  // Buffer extra para não cortar no meio de um bloco assistant+tool.
  const fetchLimit = Math.min(safeLimit + 40, 200)

  const { data, error } = await admin
    .from('chat_messages_agente')
    .select('role, message, tool_calls, tool_call_id, name, created_at, id')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(fetchLimit)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const rows = (data ?? []) as DbRow[]
  const chronological = [...rows].reverse()
  const mapped = chronological.map(rowToMessage).filter((m): m is OpenAiChatMessage => m != null)
  const sanitized = sanitizeAgenteHistory(mapped)

  if (sanitized.length <= safeLimit) return sanitized
  return sanitizeAgenteHistory(sanitized.slice(-safeLimit))
}

/** Persiste mensagens novas do turno (user + assistant/tool do loop). */
export async function saveAgenteTurn(
  event: H3Event,
  ctx: Pick<AgenteContext, 'session_id' | 'workspace_id'>,
  messages: OpenAiChatMessage[],
): Promise<void> {
  if (messages.length === 0) return

  const admin = serverSupabaseServiceRole<any>(event)
  const rows = messages.map((m) => ({
    session_id: ctx.session_id,
    workspace_id: ctx.workspace_id,
    role: m.role,
    message: m.content ?? null,
    tool_calls: m.tool_calls ?? null,
    tool_call_id: m.tool_call_id ?? null,
    name: m.name ?? null,
  }))

  const { error } = await admin.from('chat_messages_agente').insert(rows)
  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }
}
