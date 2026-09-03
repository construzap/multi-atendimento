import type { H3Event } from 'h3'
import type { AgenteToolTraceItem } from '#shared/types/agente'
import type { OpenAiToolDefinition } from '../openaiChat'
import { executeVectorSearch } from '../../enviarParaIa/executeVectorSearch'
import { argStr } from '../tools/helpers'
import { parseToolArgs, previewToolResult } from './parseBody'

export const comCategoriaToolDefinition: OpenAiToolDefinition = {
  type: 'function',
  function: {
    name: 'com_categoria',
    description:
      'USE ESSA FERRAMENTA PARA BUSCAR O PRODUTO SOLICITADO PELO CLIENTE. Pesquisa produtos no estoque (vector store) com a categoria já classificada.',
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

export async function executeComCategoriaTool(
  event: H3Event,
  rawArgs: string,
  params: { workspaceId: number; termosPesquisa: string | null },
): Promise<{ result: string; trace: AgenteToolTraceItem }> {
  const args = parseToolArgs(rawArgs)
  const query = argStr(args, 'query').trim()

  if (!query) {
    const result = 'ERRO: envie em query o produto que o cliente pediu.'
    return {
      result,
      trace: { name: 'com_categoria', args, result_preview: result },
    }
  }

  try {
    const search = await executeVectorSearch(event, {
      query,
      workspaceId: params.workspaceId,
      termosPesquisa: params.termosPesquisa,
      limit: 50,
    })
    const payload = {
      ok: search.ok,
      query: search.query,
      termos_pesquisa: search.termos_pesquisa,
      count: search.count,
      hits: search.hits.map(({ content, metadata }) => ({ content, metadata })),
    }
    const result = JSON.stringify(payload)
    return {
      result,
      trace: {
        name: 'com_categoria',
        args: { query, termos_pesquisa: params.termosPesquisa },
        result_preview: previewToolResult(result),
      },
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    const result = `Erro ao consultar produtos: ${msg}`
    return {
      result,
      trace: {
        name: 'com_categoria',
        args: { query, termos_pesquisa: params.termosPesquisa },
        result_preview: result,
      },
    }
  }
}

/** Extrai JSON de resposta da IA (aceita bloco markdown). */
export function parseFiltrarProdutosJson(reply: string): {
  raw: string
  produtos?: unknown
} {
  const trimmed = reply.trim()
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/u, '')
    .trim()

  try {
    const parsed = JSON.parse(unfenced) as { produtos?: unknown }
    if (parsed && typeof parsed === 'object' && 'produtos' in parsed) {
      return { raw: unfenced, produtos: parsed.produtos }
    }
    return { raw: unfenced }
  } catch {
    return { raw: trimmed }
  }
}
