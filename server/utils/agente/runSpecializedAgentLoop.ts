import { createError } from 'h3'
import type { H3Event } from 'h3'
import type { AgenteToolTraceItem } from '#shared/types/agente'
import type { OpenAiChatMessage } from './memory'
import {
  openaiChatCompletions,
  type OpenAiToolDefinition,
} from './openaiChat'

export type RunSpecializedAgentLoopResult = {
  reply_text: string
  tool_trace: AgenteToolTraceItem[]
  usage: { prompt_tokens?: number; completion_tokens?: number }
}

/**
 * Loop tool-calling sem memória (substitui nós LangChain Agent do N8N
 * que não tinham Postgres Chat Memory).
 */
export async function runSpecializedAgentLoop(
  event: H3Event,
  params: {
    model: string
    systemPrompt: string
    userMessage: string
    maxToolRounds: number
    tools: OpenAiToolDefinition[]
    executeTool: (
      name: string,
      rawArgs: string,
    ) => Promise<{ result: string; trace: AgenteToolTraceItem }>
    openai?: {
      apiKey: string
      baseUrl?: string | null
    }
    temperature?: number
    /** Primeira rodada obriga tool_call (equivale a “chame a ferramenta imediatamente”). */
    forceToolOnFirstRound?: boolean
  },
): Promise<RunSpecializedAgentLoopResult> {
  const {
    model,
    systemPrompt,
    userMessage,
    maxToolRounds,
    tools,
    executeTool,
    openai,
    temperature = 0,
    forceToolOnFirstRound = true,
  } = params

  const messages: OpenAiChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ]
  const tool_trace: AgenteToolTraceItem[] = []
  let prompt_tokens = 0
  let completion_tokens = 0

  for (let round = 0; round < maxToolRounds; round++) {
    const completion = await openaiChatCompletions(event, {
      model,
      messages,
      tools,
      tool_choice:
        forceToolOnFirstRound && round === 0 && tools.length > 0
          ? 'required'
          : 'auto',
      temperature,
      apiKey: openai?.apiKey,
      baseUrl: openai?.baseUrl,
    })

    if (completion.usage?.prompt_tokens) prompt_tokens += completion.usage.prompt_tokens
    if (completion.usage?.completion_tokens) {
      completion_tokens += completion.usage.completion_tokens
    }

    const msg = completion.choices?.[0]?.message
    if (!msg) {
      throw createError({
        statusCode: 502,
        statusMessage: 'OpenAI não retornou mensagem.',
      })
    }

    messages.push({
      role: 'assistant',
      content: msg.content ?? null,
      tool_calls: msg.tool_calls,
    })

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
      }
    }

    for (const call of toolCalls) {
      const name = call.function?.name ?? ''
      const rawArgs = call.function?.arguments ?? '{}'
      const { result, trace } = await executeTool(name, rawArgs)
      tool_trace.push(trace)
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        name,
        content: result,
      })
    }
  }

  throw createError({
    statusCode: 504,
    statusMessage: `Agente excedeu max_tool_rounds (${maxToolRounds}).`,
  })
}
