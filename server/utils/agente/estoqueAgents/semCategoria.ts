import type { H3Event } from 'h3'
import type { AgenteToolTraceItem } from '#shared/types/agente'
import type { OpenAiToolDefinition } from '../openaiChat'
import { executeVectorSearch } from '../../enviarParaIa/executeVectorSearch'
import { argStr } from '../tools/helpers'
import { parseToolArgs, previewToolResult } from './parseBody'

export const semCategoriaToolDefinition: OpenAiToolDefinition = {
  type: 'function',
  function: {
    name: 'sem_categoria',
    description:
      'USE ESSA FERRAMENTA PARA BUSCAR O PRODUTO SOLICITADO PELO CLIENTE. Pesquisa produtos no estoque sem filtrar por categoria.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'PESQUISE PELO PRODUTO QUE O CLIENTE PEDIU',
        },
      },
      required: ['query'],
    },
  },
}

export async function executeSemCategoriaTool(
  event: H3Event,
  rawArgs: string,
  workspaceId: number,
): Promise<{ result: string; trace: AgenteToolTraceItem }> {
  const args = parseToolArgs(rawArgs)
  const query = argStr(args, 'query').trim()

  if (!query) {
    const result = 'ERRO: envie em query o produto que o cliente pediu.'
    return {
      result,
      trace: { name: 'sem_categoria', args, result_preview: result },
    }
  }

  try {
    const search = await executeVectorSearch(event, {
      query,
      workspaceId,
      termosPesquisa: null,
      limit: 10,
    })
    const payload = {
      ok: search.ok,
      query: search.query,
      count: search.count,
      hits: search.hits.map(({ content, metadata }) => ({ content, metadata })),
    }
    const result = JSON.stringify(payload)
    return {
      result,
      trace: {
        name: 'sem_categoria',
        args: { query },
        result_preview: previewToolResult(result),
      },
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    const result = `Erro ao consultar produtos: ${msg}`
    return {
      result,
      trace: { name: 'sem_categoria', args: { query }, result_preview: result },
    }
  }
}
