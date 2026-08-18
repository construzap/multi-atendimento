import { argAny, argStr, ctxStr, type ToolDef } from './helpers'

export const orcamentoprontoTool: ToolDef = {
  name: 'orcamentopronto',
  description:
    'Use essa ferramenta para informar um atendente que o cliente finalizou o orçamento.\n\n' +
    'PROTOCOLO OBRIGATÓRIO ANTES DE CHAMAR:\n' +
    '1) Com o orçamento completo (todos os produtos e quantidades definidos), chame primeiro a ferramenta <estoque> para CADA produto do orçamento (um por vez).\n' +
    '2) Guarde o id retornado pela <estoque> de cada produto.\n' +
    '3) Só então chame <orcamentopronto>, enviando em produtos um array de objetos {id, nome, quantidade} — usando exatamente o id da <estoque>, o nome do produto e a quantidade escolhida, sem preço unitário.\n\n' +
    'CAMPOS OBRIGATÓRIOS NA CHAMADA:\n' +
    '- produtos, total_do_orcamento, forma_pagamento, entrega_ou_retirada, observacao\n' +
    '- Se for ENTREGA: o campo endereco é OBRIGATÓRIO (não coloque o endereço em observacao).\n' +
    '- Se o cliente informou CPF ou CNPJ: preencha documento com o valor informado.\n' +
    '- Se a forma de pagamento for DINHEIRO: o campo troco é OBRIGATÓRIO (quanto de troco o cliente vai precisar).\n\n' +
    'Proibido: chamar <orcamentopronto> sem ter obtido os ids via <estoque>.\n' +
    'Proibido: inventar id, enviar array vazio ou incluir preço unitário no array de produtos.\n' +
    'Proibido: colocar endereço, forma de pagamento, troco ou "entrega/retirada" dentro de observacao.',
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
          'SOMENTE um resumo objetivo da conversa (o que o cliente pediu e o que foi combinado). Não inclua endereço, documento, forma de pagamento, troco nem entrega/retirada neste campo.',
      },
      forma_pagamento: {
        type: 'string',
        description:
          'Forma de pagamento escolhida pelo cliente (ex.: Pix, cartão, dinheiro). Se for dinheiro, preencha também o campo troco.',
      },
      troco: {
        type: 'string',
        description:
          'OBRIGATÓRIO quando forma_pagamento for dinheiro.\n' +
          'Informe quanto de troco o cliente vai precisar.\n' +
          'Se ele disse com quanto vai pagar (ex.: "vou pagar com 100" e o total é 80), calcule o troco (20) e envie o valor.\n' +
          'Se ele disse que não precisa de troco, envie "sem troco".\n' +
          'Se a forma de pagamento NÃO for dinheiro, envie string vazia "".\n' +
          'Nunca coloque o troco em observacao.',
      },
      entrega_ou_retirada: {
        type: 'string',
        description:
          'Apenas "entrega" ou "retirada". NÃO coloque o endereço aqui — endereço vai no campo endereco.',
      },
      Orcamento_confirmado: {
        type: 'string',
        description: 'O orçamento que foi confirmado, no modelo com produtos, frete e valor total.',
      },
      email: {
        type: 'string',
        description: 'email do cliente que ele informou',
      },
      documento: {
        type: 'string',
        description:
          'CPF ou CNPJ informado pelo cliente. Se ele informou, envie o valor aqui. Não invente. Se não informou, envie string vazia "".',
      },
      endereco: {
        type: 'string',
        description:
          'OBRIGATÓRIO quando entrega_ou_retirada for "entrega".\n' +
          'Formato: "Endereço: {endereço completo do cliente}".\n' +
          'Se ele enviou a localização no mapa: "Endereço: cliente enviou a localização".\n' +
          'Se for retirada: envie string vazia "".\n' +
          'Nunca coloque o endereço em observacao.',
      },
    },
    required: [
      'produtos',
      'total_do_orcamento',
      'forma_pagamento',
      'entrega_ou_retirada',
      'observacao',
      'endereco',
      'documento',
      'troco',
    ],
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
    troco: argStr(args, 'troco'),
    'entrega ou retirada': argStr(args, 'entrega_ou_retirada'),
    workspace_id: String(ctx.workspace_id),
    canal_id: String(ctx.canal_id),
    'Orçamento confirmado': argStr(args, 'Orcamento_confirmado', 'Or_amento_confirmado'),
    'nome da empresa': ctxStr(ctx.name_cliente_empresa),
    email: argStr(args, 'email') || ctxStr(ctx.email),
    documento: argStr(args, 'documento'),
    endereco: argStr(args, 'endereco', 'endereço'),
    CHAVE_PIX_ALEATORIA: ctx.chave_pix_aleatoria,
  }),
}
