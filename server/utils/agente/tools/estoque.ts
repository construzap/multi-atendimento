import { argStr, ctxStr, type ToolDef } from './helpers'

export const estoqueTool: ToolDef = {
  name: 'estoque',
  description:
    'Chame essa ferramenta sempre que precisar consultar preço e disponibilidade de produtos.\n\n' +
    'Lembrete: Caso o cliente solicite uma lista de produtos, busque sempre um produto de cada vez.\n\n' +
    'Atenção: caso tenha mais de um produto, chame para cada produto individual!\n\n' +
    '## Quando o cliente perguntar sobre qualquer produto, chame e acione imediatamente a ferramenta <estoque>!\n\n' +
    'REGRA CRÍTICA DE PROCESSAMENTO: UM POR UM\n' +
    'Ao receber um pedido com múltiplos itens, siga o protocolo de Chamada Individual Obrigatória. A ferramenta <estoque> só processa um (1) único produto por vez.\n\n' +
    'Protocolo de Execução:\n' +
    '1) Identifique todos os produtos da lista do cliente.\n' +
    '2) Para CADA item, acione a ferramenta <estoque> de forma independente.\n' +
    '3) Se houver 7 itens, realize 7 chamadas distintas antes de formular qualquer resposta.\n\n' +
    'REGRA DE QUANTIDADE E EMBALAGEM:\n' +
    'Quando o cliente informar quantidade e/ou tipo de embalagem/unidade, inclua TUDO no campo produtos_ exatamente como ele pediu — quantidade numérica (ou por extenso convertida), tipo de embalagem/unidade e nome do produto.\n' +
    'Não resuma nem omita a embalagem. Ex.: "4 fardos de Cimento CP II", não apenas "Cimento CP II".\n' +
    'Se o cliente NÃO informou quantidade nem embalagem, envie apenas o nome do produto.\n\n' +
    'Proibido: enviar listas, múltiplos produtos ou termos genéricos em uma única chamada.\n\n' +
    'ID DO PRODUTO (OBRIGATÓRIO PARA ORÇAMENTO/FRETE):\n' +
    'A resposta da <estoque> inclui o id numérico do produto (ex.: 7203). ' +
    'Guarde esse número — ele é o único valor válido para o campo id em <orcamentopronto> e <frete>. ' +
    'Nunca use o nome do produto como id.',
  parameters: {
    type: 'object',
    properties: {
      produtos_: {
        type: 'string',
        description:
          'Um único produto por chamada, com quantidade e embalagem/unidade quando o cliente informou.\n\n' +
          'Formato: "{quantidade} {embalagem/unidade} de {nome do produto}" ou "{quantidade} {nome do produto}".\n\n' +
          'Inclua quantidade E tipo de embalagem/unidade sempre que o cliente mencionar. Preserve abreviações comuns expandindo quando necessário (cx = caixa, pk/pek/pack = pack, fd = fardo, etc.).\n\n' +
          'Exemplos de como o cliente pode pedir (envie nesse espírito):\n' +
          '- "um milheiro de {produto}"\n' +
          '- "4 fardos de {produto}" / "1 fardo de {produto}" / "quarenta fardinhos de {produto}"\n' +
          '- "2 caixas de {produto}" / "uma caixa de {produto}" / "3 cx de {produto}"\n' +
          '- "5 {produto}" / "um {produto}" / "4{produto}" (sem espaço)\n' +
          '- "2 litros de {produto}" / "35 litrinho de {produto}"\n' +
          '- "um pack de {produto}" / "3 pek de {produto}"\n' +
          '- "latao de {produto}"\n' +
          '- "meio metro de {produto}"\n' +
          '- "0,5 de {produto}" / "metade de {produto}"\n\n' +
          'Regras:\n' +
          '- Se informou quantidade + embalagem: envie os três (ex.: "4 fardos de Cimento CP II").\n' +
          '- Se informou só quantidade: envie quantidade + produto (ex.: "5 Parafuso 6x40").\n' +
          '- Se informou só embalagem/unidade sem número: envie como disse (ex.: "latao de Tinta Branca").\n' +
          '- Se NÃO informou quantidade nem embalagem: envie só o nome do produto.\n' +
          '- Nunca invente quantidade ou embalagem que o cliente não disse.\n\n' +
          'Coloque o preço do produto se foi de cartão (a prazo) ou à vista, quando aplicável.',
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
