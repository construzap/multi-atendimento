import { createError } from 'h3'
import type { H3Event } from 'h3'
import type { AgenteContext, AgenteToolTraceItem } from '#shared/types/agente'
import { openaiChatCompletions } from './openaiChat'
import { sanitizeAgenteHistory, type OpenAiChatMessage } from './memory'
import { getOpenAiToolDefinitions, executeAgenteTool } from './tools/registry'

export type RunAgentLoopResult = {
  reply_text: string
  tool_trace: AgenteToolTraceItem[]
  usage: { prompt_tokens?: number; completion_tokens?: number }
  /** Mensagens novas deste turno (user + assistant/tool) para persistir. */
  new_messages: OpenAiChatMessage[]
}

export async function runAgentLoop(
  event: H3Event,
  params: {
    ctx: AgenteContext
    systemPrompt: string
    history: OpenAiChatMessage[]
    /** Credenciais OpenAI do canal (api_key descriptografada + url). */
    openai?: {
      apiKey: string
      baseUrl?: string | null
    }
  },
): Promise<RunAgentLoopResult> {
  const { ctx, systemPrompt, history, openai } = params
  const tools = getOpenAiToolDefinitions()

  const safeHistory = sanitizeAgenteHistory(history.filter((m) => m.role !== 'system'))

  const messages: OpenAiChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...safeHistory,
    { role: 'user', content: ctx.mensagem },
  ]

  const newMessages: OpenAiChatMessage[] = [{ role: 'user', content: ctx.mensagem }]
  const tool_trace: AgenteToolTraceItem[] = []
  let prompt_tokens = 0
  let completion_tokens = 0

  for (let round = 0; round < ctx.max_tool_rounds; round++) {
    const completion = await openaiChatCompletions(event, {
      model: ctx.model,
      messages,
      tools,
      tool_choice: 'auto',
      apiKey: openai?.apiKey,
      baseUrl: openai?.baseUrl,
    })

    if (completion.usage?.prompt_tokens) prompt_tokens += completion.usage.prompt_tokens
    if (completion.usage?.completion_tokens) {
      completion_tokens += completion.usage.completion_tokens
    }

    const choice = completion.choices?.[0]
    const msg = choice?.message
    if (!msg) {
      throw createError({
        statusCode: 502,
        statusMessage: 'OpenAI não retornou mensagem.',
      })
    }

    const assistantMsg: OpenAiChatMessage = {
      role: 'assistant',
      content: msg.content ?? null,
      tool_calls: msg.tool_calls,
    }
    messages.push(assistantMsg)
    newMessages.push(assistantMsg)

    const toolCalls = msg.tool_calls ?? []
    if (toolCalls.length === 0) {
      const reply = (msg.content ?? '').trim()
      if (!reply) {
        throw createError({
          statusCode: 502,
          statusMessage: 'Agente finalizou sem texto de resposta.',
        })
      }
      return {
        reply_text: reply,
        tool_trace,
        usage: { prompt_tokens, completion_tokens },
        new_messages: newMessages,
      }
    }

    for (const call of toolCalls) {
      const name = call.function?.name ?? ''
      const rawArgs = call.function?.arguments ?? '{}'
      const { result, trace } = await executeAgenteTool(event, name, rawArgs, ctx)
      tool_trace.push(trace)

      const toolMsg: OpenAiChatMessage = {
        role: 'tool',
        tool_call_id: call.id,
        name,
        content: result,
      }
      messages.push(toolMsg)
      newMessages.push(toolMsg)
    }
  }

  throw createError({
    statusCode: 504,
    statusMessage: `Agente excedeu max_tool_rounds (${ctx.max_tool_rounds}).`,
  })
}
