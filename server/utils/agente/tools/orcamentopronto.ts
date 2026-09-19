import { argAny, argStr, ctxStr, type ToolDef } from './helpers'

export const orcamentoprontoTool: ToolDef = {
  name: 'orcamentopronto',
  description:
    'Use essa ferramenta para informar um atendente que o cliente finalizou o orçamento.\n\n' +
    'PROTOCOLO OBRIGATÓRIO ANTES DE CHAMAR:\n' +
    '1) Com o orçamento completo (produtos e quantidades definidos), use o id NUMÉRICO de cada produto.\n' +
    '2) Prefira ids já obtidos no histórico da conversa. Só chame <estoque> de novo para itens sem id válido.\n' +
    '3) Chame <orcamentopronto> com produtos = array de {id, nome, quantidade} — id numérico, nome e quantidade, sem preço unitário.\n\n' +
    'ITENS INTEIROS vs COMBINAÇÃO (metade/metade, 3 sabores, etc.):\n' +
    '- Item inteiro: apenas {id, nome, quantidade}. NÃO envie grupo nem partes.\n' +
    '- Combinação (ex.: pizza meio a meio): uma linha por sabor, TODAS com o MESMO grupo (ex.: "g1") e o mesmo partes (2, 3 ou 4).\n' +
    '- Em cada linha da combinação, quantidade deve ser 1 (é 1 unidade combinada, NÃO use 0.5).\n' +
    '- Ex. metade/metade:\n' +
    '  [{id:"7203",nome:"Calabresa",quantidade:1,grupo:"g1",partes:2},{id:"7208",nome:"Mussarela",quantidade:1,grupo:"g1",partes:2}]\n' +
    '- Se houver 2 pizzas meio a meio diferentes, use grupos distintos (g1, g2, …).\n\n' +
    'COMBO + GELOS SABORIZADOS:\n' +
    '- Envie o COMBO como item INTEIRO no array produtos (só {id, nome, quantidade} do combo).\n' +
    '- NÃO adicione linhas dos gelos em produtos. NÃO use grupo/partes para combo+gelos.\n' +
    '- Os sabores dos gelos escolhidos pelo cliente vão SOMENTE no campo observacao.\n' +
    '- Ex. produtos: [{id:"5411",nome:"Combo Whisky Red Label + 6 Gelos Sabores + Energético Start 2L",quantidade:1}]\n' +
    '- Ex. observacao: "Combo Red Label; gelos: 1 limão, 1 morango, 1 abacaxi, 1 uva, 1 maracujá, 1 coco"\n' +
    '- total_do_orcamento = preço do combo (não some gelos).\n\n' +
    'CAMPOS OBRIGATÓRIOS NA CHAMADA:\n' +
    '- produtos, total_do_orcamento, forma_pagamento, entrega_ou_retirada, observacao, frete\n' +
    '- frete: valor do frete (ex.: "15.00") ou "gratis"/"frete gratis" se for entrega gratuita; use "0" ou "retirada" se for retirada na loja.\n' +
    '- Se for ENTREGA: o campo endereco é OBRIGATÓRIO (não coloque o endereço em observacao).\n' +
    '- Se o cliente informou CPF ou CNPJ: preencha documento com o valor informado.\n' +
    '- Se a forma de pagamento for DINHEIRO: o campo troco_para é OBRIGATÓRIO (valor com que o cliente vai pagar).\n\n' +
    'Proibido: inventar id ou chamar <orcamentopronto> sem ids válidos (do histórico ou de <estoque>).\n' +
    'Proibido: inventar id, enviar array vazio ou incluir preço unitário no array de produtos.\n' +
    'Proibido: usar quantidade fracionária (0.5) — use grupo + partes com quantidade 1 em cada sabor.\n' +
    'Proibido: colocar endereço, forma de pagamento, troco_para ou "entrega/retirada" dentro de observacao.\n' +
    'Proibido: em combo com gelos escolhidos, omitir os sabores no campo observacao.',
  parameters: {
    type: 'object',
    properties: {
      produtos: {
        type: 'array',
        description:
          'Array com um objeto por produto do orçamento. Cada item DEVE usar o id da <estoque>, o nome e a quantidade. ' +
          'Formato base: [{id, nome, quantidade}]. ' +
          'Se for combinação (metade/metade, 3 sabores…), adicione grupo (mesmo id nas partes) e partes (2, 3 ou 4). ' +
          'Combo com gelos: envie só a linha do combo (item inteiro); sabores dos gelos vão em observacao. ' +
          'Sem grupo = item inteiro. Não inclua preço.',
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
              description:
                'Quantidade do item. Em combinação (mesmo grupo), use sempre 1 em cada linha (1 unidade combinada). ' +
                'Não use frações como 0.5.',
            },
            grupo: {
              type: 'string',
              description:
                'OPCIONAL. Só em combinação (ex.: pizza meio-meio): identificador do grupo (ex.: "g1"). ' +
                'Todas as partes da mesma unidade devem ter o MESMO grupo. ' +
                'Omita em item inteiro e em combo (gelos vão em observacao).',
            },
            partes: {
              type: 'number',
              description:
                'OPCIONAL. Só em combinação: em quantos pedaços a unidade foi dividida (2, 3 ou 4). ' +
                'Deve ser igual em todas as linhas do mesmo grupo. Omita em item inteiro e em combo.',
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
          'SOMENTE um resumo objetivo da conversa (o que o cliente pediu e o que foi combinado).\n' +
          'COMBO + GELOS: se o cliente escolheu sabores de gelo do combo, liste AQUI os gelos escolhidos ' +
          '(ex.: "gelos: 1 limão, 1 morango, 1 abacaxi, 1 uva, 1 maracujá, 1 coco"). ' +
          'Não envie os gelos no array produtos.\n' +
          'Não inclua endereço, documento, forma de pagamento, troco_para nem entrega/retirada neste campo.',
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
    user_id: ctxStr(ctx.user_id),
    mensagem_pix_manual: ctxStr(ctx.mensagem_pix_manual),
    pixType: ctxStr(ctx.pixType),
    valor_pedido_minimo: ctx.valor_pedido_minimo,
  }),
}
