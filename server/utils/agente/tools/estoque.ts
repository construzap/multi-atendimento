import { argStr, ctxStr, type ToolDef } from './helpers'

export const estoqueTool: ToolDef = {
  name: 'estoque',
  description:
    'Chame essa ferramenta quando precisar de informações sobre nossos produtos.\n\n' +
    '## Quando o cliente perguntar sobre qualquer produto, chame e acione imediatamente a ferramenta <estoque>!\n\n' +
    'REGRA CRÍTICA — NÃO INVENTAR QUANTIDADE:\n' +
    'Nunca coloque "1", "um", "uma" ou qualquer número no campo produtos_ se o cliente NÃO disse quantidade.\n' +
    'Pergunta de preço/valor ("qual o valor...", "quanto custa...", "tem o preço do...") = SEM quantidade.\n' +
    'Ex.: cliente: "qual o valor do latão de Brahma" → envie exatamente "latão de Brahma" (NÃO "1 latão de Brahma").\n' +
    'Ex.: cliente: "quanto custa a Brahma" → envie "Brahma" (NÃO "1 Brahma").\n' +
    'Só inclua quantidade se o cliente falou número ou por extenso (ex.: "2", "dois", "meio").\n\n' +
    'Lembrete: Caso o cliente solicite uma lista de produtos, busque sempre um produto de cada vez.\n\n' +
    'Atenção: caso tenha mais de um produto, chame para cada produto individual!\n\n' +
    'REGRA CRÍTICA DE PROCESSAMENTO: UM POR UM\n' +
    'Ao receber um pedido com múltiplos itens, siga o protocolo de Chamada Individual Obrigatória. A ferramenta <estoque> só processa um (1) único produto por vez.\n\n' +
    'Protocolo de Execução:\n' +
    '1) Identifique todos os produtos da lista do cliente.\n' +
    '2) Para CADA item, acione a ferramenta <estoque> de forma independente.\n' +
    '3) Se houver 7 itens, realize 7 chamadas distintas antes de formular qualquer resposta.\n\n' +
    'REGRA DE QUANTIDADE E EMBALAGEM:\n' +
    'Quando o cliente informar quantidade e/ou tipo de embalagem/unidade, inclua TUDO no campo produtos_ exatamente como ele pediu — quantidade numérica (ou por extenso convertida), tipo de embalagem/unidade e nome do produto.\n' +
    'Não resuma nem omita a embalagem. Ex.: "4 fardos de Cimento CP II", não apenas "Cimento CP II".\n' +
    'Se o cliente NÃO informou quantidade: NÃO invente "1" — envie embalagem+nome ou só o nome.\n\n' +
    'Proibido: enviar listas, múltiplos produtos ou termos genéricos em uma única chamada.\n' +
    'Proibido: inventar quantidade (incluindo "1" / "um") quando o cliente não informou.\n\n' +
    'ID DO PRODUTO (OBRIGATÓRIO PARA ORÇAMENTO):\n' +
    'A resposta da <estoque> inclui o id numérico do produto (ex.: 7203). ' +
    'Guarde esse número — ele é o único valor válido para o campo id em <orcamentopronto>. ' +
    'Nunca use o nome do produto como id.',
  parameters: {
    type: 'object',
    properties: {
      produtos_: {
        type: 'string',
        description:
          'Um único produto por chamada. COPIE o que o cliente pediu; NÃO complete com quantidade inventada.\n\n' +
          'Formatos permitidos (escolha o que o cliente realmente disse):\n' +
          '- Só nome: "{produto}"\n' +
          '- Só embalagem/unidade + nome: "{embalagem} de {produto}" (ex.: "latão de Brahma")\n' +
          '- Quantidade + embalagem + nome: "{quantidade} {embalagem} de {produto}" — SÓ se o cliente disse a quantidade\n' +
          '- Quantidade + nome: "{quantidade} {produto}" — SÓ se o cliente disse a quantidade\n\n' +
          'Exemplos CORRETOS (consulta de preço / sem quantidade):\n' +
          '- Cliente: "qual o valor do latão de Brahma" → "latão de Brahma"\n' +
          '- Cliente: "quanto custa a Heineken" → "Heineken"\n' +
          '- Cliente: "tem preço do pack de Amstel?" → "pack de Amstel"\n\n' +
          'Exemplos CORRETOS (com quantidade dita pelo cliente):\n' +
          '- "4 fardos de Cimento CP II"\n' +
          '- "2 caixas de {produto}" / "3 cx de {produto}"\n' +
          '- "5 Parafuso 6x40"\n' +
          '- "2 litros de {produto}"\n' +
          '- "meio metro de {produto}" / "0,5 de {produto}"\n\n' +
          'Exemplos ERRADOS (proibido):\n' +
          '- Cliente não disse quantidade → NÃO envie "1 latão de Brahma" nem "um latão de Brahma"\n' +
          '- Cliente não disse quantidade → NÃO envie "1 Brahma"\n\n' +
          'Preserve abreviações comuns expandindo quando necessário (cx = caixa, pk/pek/pack = pack, fd = fardo, etc.).\n' +
          'Nunca invente quantidade ou embalagem que o cliente não disse.',
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
    fase_teste: ctx.fase_teste,
    url_aplicativo: ctxStr(ctx.url_aplicativo),
    ngrok_skip_browser_warning: ctx.ngrok_skip_browser_warning,
    endereco_loja: ctxStr(ctx.endereco_loja),
    produtos_contexto: ctx.produtos_contexto,
    user_id: ctxStr(ctx.user_id),
  }),
}
