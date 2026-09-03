import { assertMethod, createError, readBody } from 'h3'
import { requireN8nAgenteApiKey } from '../../../utils/requireN8nAgenteApiKey'
import {
  parseCanalId,
  parseMaxToolRounds,
  parseWorkspaceIdFromEstoqueBody,
  pickProdutos,
  requireSystemPrompt,
  resolveEstoqueAgentOpenAi,
  strOrEmpty,
  strOrNull,
} from '../../../utils/agente/estoqueAgents/parseBody'
import {
  comCategoriaToolDefinition,
  executeComCategoriaTool,
  parseFiltrarProdutosJson,
} from '../../../utils/agente/estoqueAgents/comCategoria'
import { runSpecializedAgentLoop } from '../../../utils/agente/runSpecializedAgentLoop'
import type { AgenteEspecializadoResponse } from '#shared/types/agente'

/**
 * POST /api/public/agente/filtrar-produtos
 *
 * Body: {
 *   workspace_id, canal_id | id_canal, produtos | "produtos ",
 *   termos_pesquisa, system_prompt  // system_prompt obrigatório
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

  const termosPesquisaRaw = strOrEmpty(
    body.termos_pesquisa ?? body.categorias ?? body.output,
  )
  const termosPesquisa = termosPesquisaRaw || null

  const openai = await resolveEstoqueAgentOpenAi(event, {
    workspace_id,
    canal_id,
    modelOverride: strOrNull(body.model),
  })
  const maxToolRounds = parseMaxToolRounds(body.max_tool_rounds, Math.min(openai.maxToolRounds, 4))

  const userMessage = `Produto solicitado: ${produtos}`

  const result = await runSpecializedAgentLoop(event, {
    model: openai.model,
    systemPrompt,
    userMessage,
    maxToolRounds,
    tools: [comCategoriaToolDefinition],
    executeTool: (name, rawArgs) => {
      if (name !== 'com_categoria') {
        const text = `Ferramenta desconhecida: ${name}`
        return Promise.resolve({
          result: text,
          trace: { name, args: rawArgs, result_preview: text },
        })
      }
      return executeComCategoriaTool(event, rawArgs, {
        workspaceId: workspace_id,
        termosPesquisa,
      })
    },
    openai: {
      apiKey: openai.apiKey,
      baseUrl: openai.baseUrl,
    },
  })

  const parsed = parseFiltrarProdutosJson(result.reply_text)

  return {
    ok: true,
    reply_text: parsed.raw,
    output: parsed.raw,
    model: openai.model,
    tool_trace: result.tool_trace,
    usage: result.usage,
    ...(parsed.produtos !== undefined ? { produtos: parsed.produtos } : {}),
  }
})
