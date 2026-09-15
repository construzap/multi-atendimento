import { createError } from 'h3'
import type { H3Event } from 'h3'
import type { OpenAiChatMessage } from './memory'
import { resolveOpenAiChatCompletionsUrl } from './loadCanalCredenciais'

export type OpenAiToolDefinition = {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export type OpenAiChatCompletionResponse = {
  id?: string
  choices?: Array<{
    message?: {
      role?: string
      content?: string | null
      tool_calls?: OpenAiChatMessage['tool_calls']
    }
    finish_reason?: string
  }>
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
  error?: { message?: string }
}

export async function openaiChatCompletions(
  event: H3Event,
  params: {
    model: string
    messages: OpenAiChatMessage[]
    tools?: OpenAiToolDefinition[]
    tool_choice?: 'auto' | 'none' | 'required'
    temperature?: number
    /** API key do canal (descriptografada). Obrigatória — sem fallback de env. */
    apiKey?: string
    /** URL do canal (base ou endpoint completo). */
    baseUrl?: string | null
  },
): Promise<OpenAiChatCompletionResponse> {
  const apiKey = String(params.apiKey ?? '').trim()
  if (!apiKey) {
    throw createError({
      statusCode: 400,
      statusMessage:
        'API key da OpenAI não cadastrada neste canal. Configure a API key na página de Canais.',
    })
  }

  const endpoint = resolveOpenAiChatCompletionsUrl(params.baseUrl)

  // GPT-5 (nano/mini/etc.) só aceita o default de temperature (1).
  const modelLower = String(params.model ?? '').toLowerCase()
  const isGpt5 = /(^|\/)gpt-5/.test(modelLower)
  const temperature = isGpt5 ? 1 : (params.temperature ?? 0.2)

  const body: Record<string, unknown> = {
    model: params.model,
    messages: params.messages,
    temperature,
  }

  if (params.tools?.length) {
    body.tools = params.tools
    body.tool_choice = params.tool_choice ?? 'auto'
  }

  let res: OpenAiChatCompletionResponse
  try {
    res = await $fetch<OpenAiChatCompletionResponse>(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body,
      timeout: 120_000,
    })
  } catch (err: unknown) {
    const msg =
      err && typeof err === 'object' && 'data' in err
        ? JSON.stringify((err as { data: unknown }).data)
        : err instanceof Error
          ? err.message
          : String(err)
    throw createError({
      statusCode: 502,
      statusMessage: `Falha na OpenAI: ${msg.slice(0, 500)}`,
    })
  }

  if (res?.error?.message) {
    throw createError({
      statusCode: 502,
      statusMessage: `OpenAI: ${res.error.message}`,
    })
  }

  return res
}
