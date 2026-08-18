import { argAny, argStr, ctxStr, type ToolDef } from './helpers'

export const solicitaPagamentoTool: ToolDef = {
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
}
