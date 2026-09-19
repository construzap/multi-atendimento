import { argStr, ctxStr, type ToolDef } from './helpers'

export const estoqueTool: ToolDef = {
  name: 'estoque',
  description:
    'Busca dados de produto (preço, disponibilidade, id) quando AINDA NÃO tiver essas informações no histórico da conversa.\n\n' +
    'QUANDO CHAMAR:\n' +
    '- Cliente pergunta preço/disponibilidade/opções de um produto ainda não consultado nesta conversa.\n' +
    '- Produto novo no pedido sem id/preço no histórico.\n' +
    '- Precisa do id numérico e ele NÃO está no histórico (para frete/orçamento).\n' +
    '- Consulta anterior falhou, veio vazia ou ambígua.\n\n' +
    'QUANDO NÃO CHAMAR (obrigatório):\n' +
    '- Já consultou esse produto nesta conversa e ainda tem nome, preço e/ou id no histórico — REUTILIZE esses dados.\n' +
    '- Cliente só confirma, muda quantidade, pergunta frete ou fecha pedido com produtos já conhecidos.\n' +
    '- Não chame de novo “por precaução” nem a cada menção do nome do produto.\n\n' +
    'LISTA DE ITENS:\n' +
    '- Um produto por chamada.\n' +
    '- Só chame para itens que ainda faltam dados. Pule os que já estão no histórico.\n' +
    '- Não precisa chamar todos de novo antes de responder se os dados já existem.\n\n' +
    'REGRA CRÍTICA — NÃO INVENTAR QUANTIDADE:\n' +
    'Nunca coloque "1", "um", "uma" ou qualquer número no campo produtos_ se o cliente NÃO disse quantidade.\n' +
    'Pergunta de preço/valor ("qual o valor...", "quanto custa...", "tem o preço do...") = SEM quantidade.\n' +
    'Ex.: cliente: "qual o valor do latão de Brahma" → envie exatamente "latão de Brahma" (NÃO "1 latão de Brahma").\n' +
    'Só inclua quantidade se o cliente falou número ou por extenso (ex.: "2", "dois", "meio").\n\n' +
    'REGRA DE QUANTIDADE E EMBALAGEM:\n' +
    'Quando o cliente informar quantidade e/ou tipo de embalagem/unidade, inclua TUDO no campo produtos_ exatamente como ele pediu.\n' +
    'Ex.: "4 fardos de Cimento CP II", não apenas "Cimento CP II".\n' +
    'Se o cliente NÃO informou quantidade: NÃO invente "1" — envie embalagem+nome ou só o nome.\n\n' +
    'Proibido: enviar listas, múltiplos produtos ou termos genéricos em uma única chamada.\n' +
    'Proibido: inventar quantidade (incluindo "1" / "um") quando o cliente não informou.\n\n' +
    'ID DO PRODUTO (ORÇAMENTO/FRETE):\n' +
    'A resposta da <estoque> inclui o id numérico do produto (ex.: 7203). Guarde-o.\n' +
    'Prefira o id já obtido no histórico. Só chame <estoque> de novo se o id estiver faltando ou for inválido.\n' +
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
