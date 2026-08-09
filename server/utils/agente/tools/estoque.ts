import { argStr, ctxStr, type ToolDef } from './helpers'

export const estoqueTool: ToolDef = {
  name: 'estoque',
  description:
    'Chame essa ferramenta sempre que precisar consultar preço e disponibilidade de produtos\nLembrete: Caso o cliente solicite uma lista de produtos, Busque sempre um produto de cada vez.\n\nAtenção: caso tenha mais de um produto, chame para cada produto individual!\n\n##quando o perguntar sobre qualquer produto chame e acione imediatamente a ferramenta <estoque>!  \n\nREGRA CRÍTICA DE PROCESSAMENTO: UM POR UM\nAo receber um pedido com múltiplos itens, você deve seguir o protocolo de Chamada Individual Obrigatória. A ferramenta <estoque> só processa um (1) único produto por vez.\n\nProtocolo de Execução:\n\nIdentifique todos os produtos da lista do cliente.\n\nPara CADA item identificado, acione a ferramenta <estoque> de forma independente.\n\nSe houver 7 itens, você deve realizar 7 chamadas distintas à ferramenta antes de formular qualquer resposta.\n\nProibido: Enviar listas, múltiplos produtos ou termos genéricos em uma única chamada.',
  parameters: {
    type: 'object',
    properties: {
      produtos_: {
        type: 'string',
        description:
          'Contexto do Produtos e quantidade que o cliente pediu\n\n\nse o cliente nao informou a quantidade, nao envie a quantidade! apenas o nome do produto\n\ncoloque o preço do produto se foi de cartao (a prazo) ou a vista',
      },
    },
    required: ['produtos_'],
  },
  urlConfigKey: 'agenteToolEstoqueUrl',
  buildBody: (args, ctx) => ({
    'produtos ': argStr(args, 'produtos_', 'produtos '),
    whatsapp: ctxStr(ctx.numero),
    UUID: ctxStr(ctx.UUID),
    Instancia: ctxStr(ctx.apikey),
    url_api: ctxStr(ctx.evoURL),
    'key-contact': ctx.conversa_key,
    id_canal: String(ctx.canal_id),
    workspace_id: String(ctx.workspace_id),
  }),
}
