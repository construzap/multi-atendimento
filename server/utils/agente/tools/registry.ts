import type { H3Event } from 'h3'
import type { AgenteContext, AgenteToolTraceItem } from '#shared/types/agente'
import type { OpenAiToolDefinition } from '../openaiChat'
import { executeCalculator } from './calculator'
import { estoqueTool } from './estoque'
import { argAny, argStr, ctxStr, type ToolDef } from './helpers'
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
  {
    name: 'envia_localizacao',
    description: 'Chame essa ferramenta para enviar a localização da empresa ou loja',
    parameters: {
      type: 'object',
      properties: {
        produtos_: {
          type: 'string',
          description:
            'Contexto do Produtos e quantidade que o cliente pediu\n\n\nse o cliente nao informou a quantidade, nao envie a quantidade! apenas o nome do produto',
        },
      },
      required: [],
    },
    urlConfigKey: 'agenteToolEnviaLocalizacaoUrl',
    buildBody: (args, ctx) => ({
      'produtos ': argStr(args, 'produtos_', 'produtos '),
      whatsapp: ctxStr(ctx.numero),
      Instancia: ctxStr(ctx.apikey),
      url_api: ctxStr(ctx.evoURL),
      workspace_id: String(ctx.workspace_id),
      longitude: ctxStr(ctx.longitude),
      latitude: ctxStr(ctx.latitude),
      conversa_key: ctx.conversa_key,
    }),
  },
  {
    name: 'frete',
    description: 'Chame essa ferramenta quando precisar informar o valor do frete ',
    parameters: {
      type: 'object',
      properties: {
        valor_total_do_orcamento: {
          type: 'string',
          description: 'valor total do orçamento. ',
        },
        produtos: {
          type: 'string',
          description: 'produtos exatamente como estava escrito no orçamento separado por virgula.',
        },
        codigo_dos_produtos_e_quantidade_de_cada_produto: {
          type: 'array',
          description:
            'informe o id dos produtos que retornaram da ferramenta <estoque>, o nome do produto e quantidade solicitada de cada um do orçamento. Envie um array de objetos {id, nome, quantidade}.',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              nome: { type: 'string' },
              quantidade: { type: 'number' },
            },
          },
        },
        bairro_ou_cep: {
          type: 'string',
          description:
            'bairro ou cep informado pelo cliente ou se ele enviou a localização\n\n\nSe ele  ENVIOU a localização dele, envie exatamente assim: "localização do cliente"',
        },
      },
      required: [
        'valor_total_do_orcamento',
        'produtos',
        'codigo_dos_produtos_e_quantidade_de_cada_produto',
        'bairro_ou_cep',
      ],
    },
    urlConfigKey: 'agenteToolFreteUrl',
    buildBody: (args, ctx) => ({
      url: ctxStr(ctx.url_uazapi),
      'instance token': ctxStr(ctx.apikey),
      empresa_id: String(ctx.workspace_id),
      'valor total do orcamento': argStr(args, 'valor_total_do_orcamento'),
      conversa_key: ctx.conversa_key,
      produtos: argStr(args, 'produtos'),
      'codigo dos produtos e quantidade de cada produto':
        argAny(args, 'codigo_dos_produtos_e_quantidade_de_cada_produto') ?? [],
      'bairro ou cep': argStr(args, 'bairro_ou_cep'),
    }),
  },
  {
    name: 'solicitapagamento',
    description: 'Chame essa ferramenta quando o cliente confirmar o orçamento e for solicitar o pagamento.',
    parameters: {
      type: 'object',
      properties: {
        Or_amento_confirmado: {
          type: 'string',
          description:
            'O orçamento que foi confirmado, no modelo com produtos, frete e valor total.',
        },
        valor_total_do_orcamento: {
          type: 'string',
          description: 'VALOR TOTAL (Produtos + Frete)',
        },
        email: {
          type: 'string',
          description: 'email do cliente que ele informou',
        },
        observacao: {
          type: 'string',
          description:
            'Caso o usuário opte por retirada, marque e preencha como "retirada0" caso seja entrega coloque como "entrega" e adicione o endereço coletado E A FORMA DE PAGAMENTO QUE O CLIENTE ESCOLHEU no atendimento.\n\nfaça um resumo da conversa',
        },
        forma_pagamento: {
          type: 'string',
          description: 'forma de pagamento escolhida pelo cliente',
        },
        entrega_ou_retirada: {
          type: 'string',
          description:
            'Se for entrega coloque o endereço enviado pelo cliente ou se ele enviou a localização dele! Se for retirada, avise que ele escolheu retirada',
        },
        produtos: {
          type: 'string',
          description:
            'produtos e quantidades e preço unitario de cada produto do orçamento. Ex:\n2X Produto A - R$ ...\n1X Produto B - R$ ...',
        },
      },
      required: [
        'Or_amento_confirmado',
        'valor_total_do_orcamento',
        'forma_pagamento',
        'entrega_ou_retirada',
        'produtos',
      ],
    },
    urlConfigKey: 'agenteToolSolicitaPagamentoUrl',
    buildBody: (args, ctx) => ({
      url: ctxStr(ctx.evoURL),
      'instance token': ctxStr(ctx.apikey),
      empresa_id: String(ctx.workspace_id),
      'nome da empresa': ctxStr(ctx.name_cliente_empresa),
      conversa_key: ctx.conversa_key,
      'Orçamento confirmado': argStr(args, 'Or_amento_confirmado', 'Orcamento_confirmado'),
      'valor total do orcamento': argStr(args, 'valor_total_do_orcamento'),
      phone: ctxStr(ctx.phone),
      email: argStr(args, 'email') || ctxStr(ctx.email),
      name_cliente: ctxStr(ctx.name),
      canal_id: String(ctx.canal_id),
      numero_notificar: ctxStr(ctx.phone_PARA_NOTIFICAR),
      observacao: argStr(args, 'observacao'),
      tempo_pausa: ctxStr(ctx.tempo_pausa),
      tempo_resposta: ctxStr(ctx.tempo_resposta),
      ai_assinatura_enabled: ctxStr(ctx.ai_assinatura_enabled),
      forma_pagamento: argStr(args, 'forma_pagamento'),
      'entrega ou retirada': argStr(args, 'entrega_ou_retirada'),
      produtos: argAny(args, 'produtos') ?? '',
    }),
  },
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
