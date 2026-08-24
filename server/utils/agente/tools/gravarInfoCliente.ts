import { argStr, ctxStr, type ToolDef } from './helpers'

/**
 * Grava incrementalmente dados do cliente (endereço, pagamento, etc.)
 * enquanto a conversa ainda está em andamento.
 */
export const gravarInfoClienteTool: ToolDef = {
  name: 'gravar_info_cliente',
  description:
    'Chame esta ferramenta SEMPRE que o cliente informar ou alterar algum dado pessoal ou do pedido, por exemplo:\n' +
    '- endereço de entrega ou que quer entrega na casa dele\n' +
    '- que vai retirar na loja\n' +
    '- forma de pagamento (Pix, cartão, dinheiro)\n' +
    '- se pagar em dinheiro, com quanto vai pagar ou se não precisa de troco\n\n' +
    'Pode chamar várias vezes durante a conversa, conforme novas informações forem surgindo.\n' +
    'Envie apenas o que o cliente acabou de informar ou confirmar nesta mensagem; campos que ainda não foram mencionados devem ir como string vazia "".\n' +
    'Não espere o orçamento finalizado — grave assim que o cliente der a informação.',
  parameters: {
    type: 'object',
    properties: {
      endereco_entrega: {
        type: 'string',
        description:
          'Endereço completo de entrega informado pelo cliente, ou "retirada" se ele escolheu retirar na loja, ou "cliente enviou a localização" se mandou localização no mapa. String vazia "" se ainda não foi mencionado.',
      },
      forma_pagamento: {
        type: 'string',
        description:
          'Forma de pagamento escolhida (ex.: Pix, cartão, dinheiro). Se for dinheiro e o cliente disse com quanto vai pagar ou que não precisa de troco, inclua isso aqui (ex.: "dinheiro - troco para 80" ou "dinheiro - sem troco"). String vazia "" se ainda não foi mencionado.',
      },
    },
    required: [],
  },
  urlConfigKey: 'agenteToolGravarInfoClienteUrl',
  buildBody: (args, ctx) => ({
    workspace_id: String(ctx.workspace_id),
    conversa_key: ctx.conversa_key,
    name: ctxStr(ctx.name),
    phone: ctxStr(ctx.phone) || ctxStr(ctx.telefone) || ctxStr(ctx.numero),
    endereco_entrega: argStr(args, 'endereco_entrega', 'endereço_entrega'),
    forma_pagamento: argStr(args, 'forma_pagamento'),
  }),
}
