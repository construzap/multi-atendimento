import { argStr, ctxStr, type ToolDef } from './helpers'

export const enviaLocalizacaoTool: ToolDef = {
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
}
