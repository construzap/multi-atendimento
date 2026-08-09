import { argAny, argStr, ctxStr, type ToolDef } from './helpers'

export const orcamentoprontoTool: ToolDef = {
  name: 'orcamentopronto',
  description:
    'Use essa ferramenta para informar um atendente que o cliente finalizou o orçamento.\n\nPROTOCOLO OBRIGATÓRIO ANTES DE CHAMAR:\n1) Com o orçamento completo (todos os produtos e quantidades definidos), chame primeiro a ferramenta <estoque> para CADA produto do orçamento (um por vez).\n2) Guarde o id retornado pela <estoque> de cada produto.\n3) Só então chame <orcamentopronto>, enviando em produtos um array de objetos {id, nome, quantidade} — sem preço unitário.\nProibido: chamar orcamentopronto sem ter obtido os ids via <estoque>. Proibido: enviar preço unitário no array de produtos.',
  parameters: {
    type: 'object',
    properties: {
      produtos: {
        type: 'array',
        description:
          'Array com um objeto por produto do orçamento. Cada item DEVE usar o id retornado pela ferramenta <estoque>, o nome do produto e a quantidade escolhida. Formato: [{id, nome, quantidade}]. Não inclua preço.',
        items: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Id do produto retornado pela ferramenta <estoque>',
            },
            nome: {
              type: 'string',
              description: 'Nome do produto',
            },
            quantidade: {
              type: 'number',
              description: 'Quantidade escolhida desse produto no orçamento',
            },
          },
          required: ['id', 'nome', 'quantidade'],
        },
      },
      total_do_orcamento: {
        type: 'string',
        description: 'Valor Total do Orçamento do cliente',
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
      Orcamento_confirmado: {
        type: 'string',
        description: 'O orçamento que foi confirmado, no modelo com produtos, frete e valor total.',
      },
      email: {
        type: 'string',
        description: 'email do cliente que ele informou',
      },
    },
    required: ['produtos', 'total_do_orcamento', 'forma_pagamento', 'entrega_ou_retirada'],
  },
  urlConfigKey: 'agenteToolOrcamentoProntoUrl',
  buildBody: (args, ctx) => ({
    produtos: argAny(args, 'produtos') ?? [],
    telefone: ctxStr(ctx.telefone) || ctxStr(ctx.phone) || ctxStr(ctx.numero),
    Nome: ctxStr(ctx.name),
    total_do_orcamento: argStr(args, 'total_do_orcamento'),
    Instancia: ctxStr(ctx.apikey),
    url_api: ctxStr(ctx.evoURL),
    UUID: ctxStr(ctx.UUID),
    numero_notificar: ctxStr(ctx.phone_PARA_NOTIFICAR),
    observacao: argStr(args, 'observacao'),
    'key-contact': ctx.conversa_key,
    tempo_pausa: ctxStr(ctx.tempo_pausa),
    fase_teste: ctxStr(ctx.fase_teste),
    tempo_resposta: ctxStr(ctx.tempo_resposta),
    ai_assinatura_enabled: ctxStr(ctx.ai_assinatura_enabled),
    forma_pagamento: argStr(args, 'forma_pagamento'),
    'entrega ou retirada': argStr(args, 'entrega_ou_retirada'),
    workspace_id: String(ctx.workspace_id),
    canal_id: String(ctx.canal_id),
    'Orçamento confirmado': argStr(args, 'Orcamento_confirmado', 'Or_amento_confirmado'),
    'nome da empresa': ctxStr(ctx.name_cliente_empresa),
    email: argStr(args, 'email') || ctxStr(ctx.email),
  }),
}
