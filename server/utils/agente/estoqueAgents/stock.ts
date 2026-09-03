import type { H3Event } from 'h3'
import type { AgenteToolTraceItem } from '#shared/types/agente'
import type { OpenAiToolDefinition } from '../openaiChat'
import { executeTermoVectorSearch } from '../../enviarParaIa/executeTermoVectorSearch'
import { argStr } from '../tools/helpers'
import { parseToolArgs, previewToolResult } from './parseBody'

export const stockToolDefinition: OpenAiToolDefinition = {
  type: 'function',
  function: {
    name: 'stock',
    description:
      'Consulta as categorias/termos de pesquisa cadastrados no inventário. Passe APENAS o nome do produto, sem quantidade e sem números.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'APENAS O NOME DO PRODUTO QUE O CLIENTE PEDIU. ENVIE APENAS O NOME DO PRODUTO. SOMENTE O NOME DO PRODUTO. Sem quantidade, sem números.',
        },
      },
      required: ['query'],
    },
  },
}

export async function executeStockTool(
  event: H3Event,
  rawArgs: string,
  workspaceId: number,
): Promise<{ result: string; trace: AgenteToolTraceItem }> {
  const args = parseToolArgs(rawArgs)
  const query = argStr(args, 'query').replace(/[0-9]/g, ' ').replace(/\s+/g, ' ').trim()

  if (!query) {
    const result =
      'ERRO: envie em query somente o nome do produto, sem quantidade e sem números.'
    return {
      result,
      trace: { name: 'stock', args, result_preview: result },
    }
  }

  try {
    const search = await executeTermoVectorSearch(event, {
      query,
      workspaceId,
      limit: 10,
      metadataFilters: null,
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
        name: 'stock',
        args: { query },
        result_preview: previewToolResult(result),
      },
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    const result = `Erro ao consultar stock: ${msg}`
    return {
      result,
      trace: { name: 'stock', args: { query }, result_preview: result },
    }
  }
}
