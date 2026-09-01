import type { H3Event } from 'h3'
import type { AgenteContext, AgenteToolTraceItem } from '#shared/types/agente'
import type { OpenAiToolDefinition } from '../openaiChat'
import { executeCalculator } from './calculator'
import { enviaLocalizacaoTool } from './envia_localizacao'
import { estoqueTool } from './estoque'
import { freteTool } from './frete'
import { argAny, argStr, validateProdutosIdsFromEstoque, type ToolDef } from './helpers'
import { postToolHttp } from './httpPost'
import { orcamentoprontoTool } from './orcamentopronto'
import { transferirAtendimentoTool } from './transferirAtendimento'

const TOOLS: ToolDef[] = [
  {
    name: 'calculator',
    description: 'Calculadora para operações matemáticas (soma, subtração, multiplicação, divisão).',
    parameters: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: 'Expressão matemática a calcular, ex: (10 + 5) * 2',
        },
      },
      required: ['expression'],
    },
    urlConfigKey: null,
    buildBody: () => ({}),
  },
  estoqueTool,
  enviaLocalizacaoTool,
  freteTool,
  orcamentoprontoTool,
  transferirAtendimentoTool,
]

const byName = new Map(TOOLS.map((t) => [t.name, t]))

export function getOpenAiToolDefinitions(): OpenAiToolDefinition[] {
  return TOOLS.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }))
}

function resolveToolUrl(event: H3Event, urlConfigKey: string): string {
  const config = useRuntimeConfig(event) as Record<string, unknown>
  return String(config[urlConfigKey] ?? '').trim()
}

export async function executeAgenteTool(
  event: H3Event,
  name: string,
  rawArgs: string,
  ctx: AgenteContext,
): Promise<{ result: string; trace: AgenteToolTraceItem }> {
  let args: Record<string, unknown> = {}
  try {
    args = rawArgs ? (JSON.parse(rawArgs) as Record<string, unknown>) : {}
  } catch {
    args = { _raw: rawArgs }
  }

  const tool = byName.get(name)
  if (!tool) {
    const result = `Ferramenta desconhecida: ${name}`
    return {
      result,
      trace: { name, args, result_preview: result },
    }
  }

  if (tool.urlConfigKey == null) {
    const expression = argStr(args, 'expression')
    const result = executeCalculator(expression)
    return {
      result,
      trace: { name, args, result_preview: result },
    }
  }

  if (name === 'orcamentopronto') {
    const validationError = validateProdutosIdsFromEstoque(argAny(args, 'produtos'), 'orcamentopronto')
    if (validationError) {
      return {
        result: validationError,
        trace: { name, args, result_preview: validationError },
      }
    }
  }

  if (name === 'frete') {
    const validationError = validateProdutosIdsFromEstoque(
      argAny(args, 'codigo_dos_produtos_e_quantidade_de_cada_produto'),
      'frete',
    )
    if (validationError) {
      return {
        result: validationError,
        trace: { name, args, result_preview: validationError },
      }
    }
  }

  const url = resolveToolUrl(event, tool.urlConfigKey)
  const body = tool.buildBody(args, ctx)
  const http = await postToolHttp(event, url, body)

  return {
    result: http.text,
    trace: {
      name,
      args,
      http_status: http.http_status,
      result_preview: http.text,
    },
  }
}
