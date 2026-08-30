import { createError } from 'h3'
import { CONTEUDO_PASSO_LIGACAO } from '#shared/types/mensagensProntas'

type AdminClient = {
  from: (table: string) => any
}

type ColunaInserida = {
  id: number
  nome: string
}

type SequenciaPadraoDef = {
  nome: string
  fechar_pedido_em_aberto: boolean
  /** Nome exato da coluna nativa em `funil_workspace_colunas`. */
  colunaNome: string
  passos: Array<{
    ordem: number
    tipo: 'texto' | 'ligacao'
    conteudo: string
    delay_segundos: number
    duracao_ligacao_segundos: number | null
  }>
}

/**
 * Sequências padrão criadas junto com o funil nativo do workspace.
 * Cada uma é vinculada em `funil_workspace_colunas.id_agendamento_mensagem`.
 */
export const MENSAGENS_PRONTAS_SEQUENCIAS_PADRAO: SequenciaPadraoDef[] = [
  {
    nome: 'PEDIDO CONFIRMADO ✅',
    fechar_pedido_em_aberto: false,
    colunaNome: 'Pedidos Novos',
    passos: [
      {
        ordem: 1,
        tipo: 'texto',
        conteudo:
          'Olá! ✅ Seu pedido foi confirmado com sucesso. Já estamos preparando tudo com carinho. Qualquer dúvida, é só nos chamar!',
        delay_segundos: 0,
        duracao_ligacao_segundos: null,
      },
    ],
  },
  {
    nome: 'SEU PEDIDO SAIU PARA ENTREGA 🚀',
    fechar_pedido_em_aberto: true,
    colunaNome: 'Entregas em Andamento',
    passos: [
      {
        ordem: 1,
        tipo: 'texto',
        conteudo:
          'Olá! 🚀 Boas notícias: seu pedido saiu para entrega e está a caminho. Em breve chegará até você!',
        delay_segundos: 0,
        duracao_ligacao_segundos: null,
      },
    ],
  },
  {
    nome: 'ENTREGA CHEGOU NO LOCAL',
    fechar_pedido_em_aberto: true,
    colunaNome: 'Entrega Chegou no Destino',
    passos: [
      {
        ordem: 1,
        tipo: 'ligacao',
        conteudo: CONTEUDO_PASSO_LIGACAO,
        delay_segundos: 0,
        duracao_ligacao_segundos: 15,
      },
      {
        ordem: 2,
        tipo: 'texto',
        conteudo:
          'Olá! Sua entrega chegou ao local. Por favor, prepare-se para receber o pedido. Estamos à disposição!',
        delay_segundos: 30,
        duracao_ligacao_segundos: null,
      },
    ],
  },
  {
    nome: 'PEDIDO ENTREGUE',
    fechar_pedido_em_aberto: true,
    colunaNome: 'Pedidos Entregues',
    passos: [
      {
        ordem: 1,
        tipo: 'texto',
        conteudo:
          'Olá! ✅ Seu pedido foi entregue com sucesso. Agradecemos a preferência e esperamos que tenha uma ótima experiência!',
        delay_segundos: 0,
        duracao_ligacao_segundos: null,
      },
    ],
  },
]

/**
 * Cria as 4 sequências padrão + passos e vincula cada uma em
 * `funil_workspace_colunas.id_agendamento_mensagem` pela coluna nativa correspondente.
 */
export async function criarMensagensProntasPadraoWorkspace(params: {
  admin: AdminClient
  workspaceId: number
  userId: string
  colunas: ColunaInserida[]
}): Promise<void> {
  const { admin, workspaceId, userId, colunas } = params

  const colunasPorNome = new Map(
    colunas
      .map((c) => {
        const id = typeof c.id === 'number' ? c.id : Number(c.id)
        const nome = String(c.nome ?? '').trim()
        if (!Number.isFinite(id) || id < 1 || !nome) return null
        return [nome, Math.trunc(id)] as const
      })
      .filter((x): x is readonly [string, number] => x != null),
  )

  for (const def of MENSAGENS_PRONTAS_SEQUENCIAS_PADRAO) {
    const colunaId = colunasPorNome.get(def.colunaNome)
    if (colunaId == null) {
      throw createError({
        statusCode: 500,
        statusMessage: `Coluna nativa "${def.colunaNome}" não encontrada para vincular a sequência padrão.`,
      })
    }

    const { data: sequencia, error: seqErr } = await admin
      .from('mensagens_prontas_sequencias')
      .insert({
        nome: def.nome,
        workspace_id: workspaceId,
        user_id: userId,
        coluna_destino_id: null,
        ia_ligada: true,
        fechar_pedido_em_aberto: def.fechar_pedido_em_aberto,
      })
      .select('id')
      .maybeSingle()

    if (seqErr) {
      throw createError({ statusCode: 500, statusMessage: seqErr.message })
    }

    const sequenciaId = sequencia?.id != null ? String(sequencia.id).trim() : ''
    if (!sequenciaId) {
      throw createError({
        statusCode: 500,
        statusMessage: `Falha ao criar a sequência padrão "${def.nome}".`,
      })
    }

    const passosRows = def.passos.map((p) => ({
      sequencia_id: sequenciaId,
      ordem: p.ordem,
      tipo: p.tipo,
      conteudo: p.conteudo,
      delay_segundos: p.delay_segundos,
      duracao_ligacao_segundos: p.tipo === 'ligacao' ? p.duracao_ligacao_segundos : null,
    }))

    const { error: passosErr } = await admin.from('mensagens_prontas_passos').insert(passosRows)
    if (passosErr) {
      await admin.from('mensagens_prontas_sequencias').delete().eq('id', sequenciaId)
      throw createError({ statusCode: 500, statusMessage: passosErr.message })
    }

    const { error: vinculoErr } = await admin
      .from('funil_workspace_colunas')
      .update({ id_agendamento_mensagem: sequenciaId })
      .eq('id', colunaId)
      .eq('workspace_id', workspaceId)

    if (vinculoErr) {
      throw createError({ statusCode: 500, statusMessage: vinculoErr.message })
    }
  }
}
