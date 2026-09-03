import { assertMethod, createError, readBody } from 'h3'
import { requireN8nAgenteApiKey } from '../../../utils/requireN8nAgenteApiKey'
import {
  parseCanalId,
  parseMaxToolRounds,
  parseWorkspaceIdFromEstoqueBody,
  pickProdutos,
  requireSystemPrompt,
  resolveEstoqueAgentOpenAi,
  strOrNull,
} from '../../../utils/agente/estoqueAgents/parseBody'
import {
  executeSemCategoriaTool,
  semCategoriaToolDefinition,
} from '../../../utils/agente/estoqueAgents/semCategoria'
import { runSpecializedAgentLoop } from '../../../utils/agente/runSpecializedAgentLoop'
import type { AgenteEspecializadoResponse } from '#shared/types/agente'

/**
 * POST /api/public/agente/sem-categoria
 *
 * Body: {
 *   workspace_id, canal_id | id_canal, produtos | "produtos ",
 *   system_prompt  // obrigatório
 * }
 */
export default defineEventHandler(async (event): Promise<AgenteEspecializadoResponse> => {
  assertMethod(event, 'POST')
  requireN8nAgenteApiKey(event)

  const body = (await readBody(event)) as Record<string, unknown> | null
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Body JSON inválido.' })
  }

  const workspace_id = parseWorkspaceIdFromEstoqueBody(body)
  const canal_id = parseCanalId(body)
  const produtos = pickProdutos(body)
  if (!produtos) {
    throw createError({ statusCode: 400, statusMessage: 'produtos é obrigatório.' })
  }
  const systemPrompt = requireSystemPrompt(body)

  const openai = await resolveEstoqueAgentOpenAi(event, {
    workspace_id,
    canal_id,
    modelOverride: strOrNull(body.model),
  })
  const maxToolRounds = parseMaxToolRounds(body.max_tool_rounds, Math.min(openai.maxToolRounds, 4))

  const userMessage = `Produto solicitado: ${produtos}\n`

  const result = await runSpecializedAgentLoop(event, {
    model: openai.model,
    systemPrompt,
    userMessage,
    maxToolRounds,
    tools: [semCategoriaToolDefinition],
    executeTool: (name, rawArgs) => {
      if (name !== 'sem_categoria') {
        const text = `Ferramenta desconhecida: ${name}`
        return Promise.resolve({
          result: text,
          trace: { name, args: rawArgs, result_preview: text },
        })
      }
      return executeSemCategoriaTool(event, rawArgs, workspace_id)
    },
    openai: {
      apiKey: openai.apiKey,
      baseUrl: openai.baseUrl,
    },
  })

  const output = result.reply_text.trim()

  return {
    ok: true,
    reply_text: output,
    output,
    model: openai.model,
    tool_trace: result.tool_trace,
    usage: result.usage,
  }
})
