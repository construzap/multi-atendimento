import { createError } from 'h3'
import type { H3Event } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { getPromptPrincipalId } from '../adminPrompt'
import type { AgenteContext } from '#shared/types/agente'

/** Carrega o texto do prompt principal do workspace (ou null). */
export async function loadPromptPrincipalTexto(
  event: H3Event,
  workspaceId: number,
): Promise<string | null> {
  const promptId = await getPromptPrincipalId(event, workspaceId)
  if (promptId == null) return null

  const admin = serverSupabaseServiceRole<any>(event)
  const { data, error } = await admin
    .from('prompt_workspace')
    .select('prompt')
    .eq('id', promptId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const texto = (data as { prompt?: unknown } | null)?.prompt
  if (typeof texto !== 'string' || !texto.trim()) return null
  return texto.trim()
}

/**
 * Monta o system prompt do responder: property_prompt + regras de estoque,
 * orçamento e transferência.
 */
export function buildSystemPrompt(_ctx: AgenteContext, promptBase: string): string {
  return `${promptBase}


# CONSULTA DE ESTOQUE (<estoque>)
Chame <estoque> SOMENTE se ainda não tiver os dados (preço/id) desse produto no histórico desta conversa.
Se já consultou o produto antes, REUTILIZE nome, preço e id — não chame de novo a cada menção.
Ao chamar <estoque>, NUNCA invente quantidade.
Se o cliente só perguntou preço/valor ou citou embalagem sem número (ex.: "latão de Brahma"), envie sem "1"/"um" — ex.: "latão de Brahma".
Só inclua quantidade se o cliente informou número ou por extenso.

# FINALIZAÇÃO DE PEDIDO (<orcamentopronto>)
Use o id NUMÉRICO já obtido no histórico (ex.: 7203) no campo id de cada item — nunca o nome do produto.
Só chame <estoque> de novo para itens cujo id ainda esteja faltando ou seja inválido.
Se <orcamentopronto> retornar erro de id inválido, chame <estoque> só para esses produtos e tente novamente.
COMBO + GELOS SABORIZADOS: envie só o combo em produtos (item inteiro). Liste os sabores dos gelos escolhidos no campo observacao (não coloque gelos em produtos nem use grupo/partes para isso).

# TRANSFERÊNCIA PARA ATENDENTE HUMANO
Se o cliente pedir para falar com um atendente humano / pessoa da loja / suporte humano, OU se a pergunta/assunto sair do escopo das suas instruções, chame IMEDIATAMENTE a ferramenta <transferir_atendimento> com um resumo da conversa.
Não invente resposta fora do escopo: chame <transferir_atendimento> e depois avise que um humano vai continuar.
`
}
