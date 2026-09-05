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
    '- produtos, total_do_orcamento, forma_pagamento, entrega_ou_retirada, observacao, frete\n' +
    '- frete: valor do frete (ex.: "15.00") ou "gratis"/"frete gratis" se for entrega gratuita; use "0" ou "retirada" se for retirada na loja.\n' +
    '- Se for ENTREGA: o campo endereco é OBRIGATÓRIO (não coloque o endereço em observacao).\n' +
    '- Se o cliente informou CPF ou CNPJ: preencha documento com o valor informado.\n' +
    '- Se a forma de pagamento for DINHEIRO: o campo troco_para é OBRIGATÓRIO (valor com que o cliente vai pagar).\n\n' +
    'Proibido: chamar <orcamentopronto> sem ter obtido os ids via <estoque>.\n' +
    'Proibido: inventar id, enviar array vazio ou incluir preço unitário no array de produtos.\n' +
    'Proibido: colocar endereço, forma de pagamento, troco_para ou "entrega/retirada" dentro de observacao.',
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
              description:
                'Id NUMÉRICO do produto retornado pela ferramenta <estoque> (somente dígitos, ex.: "7203"). ' +
                'Proibido usar o nome do produto aqui.',
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
          'SOMENTE um resumo objetivo da conversa (o que o cliente pediu e o que foi combinado). Não inclua endereço, documento, forma de pagamento, troco_para nem entrega/retirada neste campo.',
      },
      forma_pagamento: {
        type: 'string',
        description:
          'Forma de pagamento escolhida pelo cliente (ex.: Pix, cartão, dinheiro). Se for dinheiro, preencha também o campo troco_para.',
      },
      troco_para: {
        type: 'string',
        description:
          'OBRIGATÓRIO quando forma_pagamento for dinheiro.\n' +
          'Informe o valor COM QUE o cliente vai pagar (não calcule o troco).\n' +
          'Ex.: pedido de R$ 40 e cliente disse "vou pagar com 80" → envie "80".\n' +
          'Se ele disse que vai pagar exatamente o valor do pedido ou não precisa de troco, envie o valor total informado por ele.\n' +
          'Se a forma de pagamento NÃO for dinheiro, envie string vazia "".\n' +
          'Nunca coloque este valor em observacao.',
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
      frete: {
        type: 'string',
        description:
          'Valor do frete ou indicação de frete grátis.\n' +
          '- Entrega com frete pago: envie o valor numérico (ex.: "15.00").\n' +
          '- Frete grátis: envie "gratis" ou "frete gratis".\n' +
          '- Retirada na loja: envie "0" ou "retirada".\n' +
          'Use o valor de frete combinado com o cliente na conversa (ou "gratis" / "0" conforme o caso).',
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
      'troco_para',
      'frete',
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
    fase_teste: ctx.fase_teste,
    url_aplicativo: ctxStr(ctx.url_aplicativo),
    ngrok_skip_browser_warning: ctx.ngrok_skip_browser_warning,
    tempo_resposta: ctxStr(ctx.tempo_resposta),
    ai_assinatura_enabled: ctxStr(ctx.ai_assinatura_enabled),
    forma_pagamento: argStr(args, 'forma_pagamento'),
    troco_para: argStr(args, 'troco_para'),
    frete: argStr(args, 'frete'),
    'entrega ou retirada': argStr(args, 'entrega_ou_retirada'),
    workspace_id: String(ctx.workspace_id),
    canal_id: String(ctx.canal_id),
    'Orçamento confirmado': argStr(args, 'Orcamento_confirmado', 'Or_amento_confirmado'),
    'nome da empresa': ctxStr(ctx.name_canal_cliente),
    name_canal_cliente: ctxStr(ctx.name_canal_cliente),
    email: argStr(args, 'email') || ctxStr(ctx.email),
    documento: argStr(args, 'documento'),
    endereco: argStr(args, 'endereco', 'endereço'),
    endereco_loja: ctxStr(ctx.endereco_loja),
    status_loja: ctxStr(ctx.status_loja),
    horario_semana: ctxStr(ctx.horario_semana),
    horario_sabado: ctxStr(ctx.horario_sabado),
    horario_domingo: ctxStr(ctx.horario_domingo),
    latitude: ctxStr(ctx.latitude),
    longitude: ctxStr(ctx.longitude),
    CHAVE_PIX_ALEATORIA: ctx.chave_pix_aleatoria,
    provedor_pagamentos: ctx.provedor_pagamentos,
    credenciais_encrypted: ctx.credenciais_encrypted,
    taxas_cartao: ctx.taxas_cartao,
    loja_aberta: ctx.loja_aberta,
    agenda_pedido: ctx.agenda_pedido,
    produtos_contexto: ctx.produtos_contexto,
  }),
}
