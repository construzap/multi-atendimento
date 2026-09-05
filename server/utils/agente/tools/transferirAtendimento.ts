import { argStr, ctxStr, resolveCtxUrl, type ToolDef } from './helpers'

/**
 * Transfere o atendimento para um humano quando o cliente pede
 * ou quando o assunto sai do escopo do system prompt da I.A.
 */
export const transferirAtendimentoTool: ToolDef = {
  name: 'transferir_atendimento',
  description:
    'Chame IMEDIATAMENTE a ferramenta <transferir_atendimento> quando:\n' +
    '1) O cliente pedir para falar com um atendente humano, pessoa da loja, suporte humano, ou disser que quer transferir o atendimento.\n' +
    '2) O assunto fugir do escopo das suas instruções / system prompt (algo que você não deve ou não consegue resolver sozinho).\n\n' +
    'REGRA OBRIGATÓRIA: nesses casos você DEVE chamar <transferir_atendimento> — não apenas responder por texto.\n' +
    'Ao chamar, envie em resumo_da_conversa um resumo claro (motivo, o que já foi combinado, por que precisa de humano).\n' +
    'Depois de chamar, avise o cliente educadamente que um atendente humano vai continuar.',
  parameters: {
    type: 'object',
    properties: {
      resumo_da_conversa: {
        type: 'string',
        description:
          'Resumo objetivo da conversa até agora: motivo do contato, o que o cliente pediu, o que já foi respondido/combinado e por que precisa de um humano.',
      },
    },
    required: ['resumo_da_conversa'],
  },
  urlConfigKey: 'agenteToolTransferirAtendimento',
  buildBody: (args, ctx) => ({
    // Preferir url_uazapi; se vier expressão N8N literal, cai para evoURL
    URL_UAZAPI: resolveCtxUrl(ctx.url_uazapi, ctx.evoURL),
    Instancia: ctxStr(ctx.apikey),
    PHONE: ctxStr(ctx.telefone) || ctxStr(ctx.phone) || ctxStr(ctx.numero),
    'RESUMO DA CONVERSA': argStr(args, 'resumo_da_conversa'),
    'NOME DO CLIENTE': ctxStr(ctx.name),
    WORKSPACE_ID: String(ctx.workspace_id),
    CONVERSA_KEY: ctx.conversa_key,
    CANAL_ID: String(ctx.canal_id),
    numero_notificar: ctxStr(ctx.phone_PARA_NOTIFICAR),
    tempo_pausa: ctxStr(ctx.tempo_pausa),
    tempo_resposta: ctxStr(ctx.tempo_resposta),
    ai_assinatura_enabled: ctxStr(ctx.ai_assinatura_enabled),
    fase_teste: ctx.fase_teste,
    url_aplicativo: ctxStr(ctx.url_aplicativo),
    ngrok_skip_browser_warning: ctx.ngrok_skip_browser_warning,
    endereco_loja: ctxStr(ctx.endereco_loja),
    produtos_contexto: ctx.produtos_contexto,
    loja_aberta: ctx.loja_aberta,
    agenda_pedido: ctx.agenda_pedido,
  }),
}
