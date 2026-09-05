import { argAny, argStr, ctxStr, type ToolDef } from './helpers'

export const freteTool: ToolDef = {
  name: 'frete',
  description:
    'Chame essa ferramenta quando precisar informar o valor do frete.\n\nPROTOCOLO OBRIGATÓRIO ANTES DE CHAMAR:\n1) Para CADA produto do orçamento, chame primeiro a ferramenta <estoque> (um produto por vez).\n2) Guarde o id retornado pela <estoque> de cada produto.\n3) Só então chame <frete>, enviando em codigo_dos_produtos_e_quantidade_de_cada_produto um array de objetos {id, nome, quantidade} — usando exatamente o id da <estoque>, o nome do produto e a quantidade escolhida.\nProibido: chamar <frete> sem ter obtido os ids via <estoque>. Proibido: inventar id ou enviar array vazio.',
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
          'OBRIGATÓRIO: array com um objeto por produto. Cada item DEVE usar o id retornado pela ferramenta <estoque>, o nome do produto e a quantidade escolhida. Formato: [{id, nome, quantidade}]. Proibido inventar id — só use o que a <estoque> devolveu.',
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
    fase_teste: ctx.fase_teste,
    url_aplicativo: ctxStr(ctx.url_aplicativo),
    ngrok_skip_browser_warning: ctx.ngrok_skip_browser_warning,
    endereco_loja: ctxStr(ctx.endereco_loja),
    produtos_contexto: ctx.produtos_contexto,
  }),
}
