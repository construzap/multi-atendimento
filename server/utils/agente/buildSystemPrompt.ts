import { createError } from 'h3'
import type { H3Event } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { getPromptPrincipalId } from '../adminPrompt'
import type { AgenteContext } from '#shared/types/agente'

function str(v: string | null | undefined, fallback = ''): string {
  if (v == null) return fallback
  const s = String(v).trim()
  return s.length ? s : fallback
}

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
 * Monta system prompt no mesmo espírito do nó `agente4` no N8N:
 * property_prompt + bloco contato/endereço + regras de status_loja.
 */
export function buildSystemPrompt(ctx: AgenteContext, promptBase: string): string {
  const endereco = str(ctx.endereco, '(endereço não informado)')
  const hs = str(ctx.horario_semana, '—')
  const hsab = str(ctx.horario_sabado, '—')
  const hdom = str(ctx.horario_domingo, '—')
  const status = str(ctx.status_loja, 'ABERTO')

  return `${promptBase}


<contato_e_endereco>
Se o cliente pedir para mandar a localização da loja ou perguntar do endereço, chame a ferramenta <envia_localizacao> e aposs chamar a ferramenta <envia_localizacao> envie o endereço por escrito abaixo e horario de funcionamento.
📍 Nosso endereço:
${endereco}

🕘 Horário de atendimento:
Segunda a sexta: das ${hs}
Sábado: ${hsab}
Domingo: ${hdom}

</contato_e_endereco>


# REGRAS DE RESPOSTA
Se o usuário perguntar se a loja está aberta ou fechada OU perguntar sobre o horario de funcionamento, veja o valor de "Status atual da loja" e responda seguindo estritamente as instruções abaixo. Seja direto e envie apenas uma resposta consolidada:


Status atual da loja: "${status}"

1. Se o status for "FECHADO":
Responda exatamente: "Infelizmente nossa loja agora tá fechada, aqui está nossos horários de funcionamento:" e liste o Horário de Atendimento Completo logo abaixo.

2. Se o status for "ALMOCO":
Responda exatamente: "Infelizmente nossa loja agora tá fechada para o almoço, aqui está nossos horários de funcionamento:" e liste o Horário de Atendimento Completo logo abaixo.

3. Se o status for "ABERTO":
chame a ferramenta <envia_localizacao> e aposs chamar a ferramenta <envia_localizacao> Responda exatamente: "Nossa loja tá aberta siiim!! Venha nos visitar." Em seguida, envie o endereço completo que está em <contato_e_endereco></contato_e_endereco> e adicione o Horário de Atendimento Completo.

4. Se o status for "QUASE_ALMOCO":
chame a ferramenta <envia_localizacao> e aposs chamar a ferramenta <envia_localizacao> Responda exatamente: "Olha, estamos quase pausando para o almoço, talvez dê tempo de você chegar!" Em seguida, envie o endereço completo que está em <contato_e_endereco></contato_e_endereco> e adicione o Horário de Atendimento Completo.

5. Se o status for "QUASE_FECHANDO":
chame a ferramenta <envia_localizacao> e aposs chamar a ferramenta <envia_localizacao> Responda exatamente: "Olha, estamos quase fechando, talvez dê tempo de você chegar!" Em seguida, envie o endereço completo que está em <contato_e_endereco></contato_e_endereco> e adicione o Horário de Atendimento Completo.

# TRANSFERÊNCIA PARA ATENDENTE HUMANO
Se o cliente pedir para falar com um atendente humano / pessoa da loja / suporte humano, OU se a pergunta/assunto sair do escopo das suas instruções, chame IMEDIATAMENTE a ferramenta <transferir_atendimento> com um resumo da conversa.
Não invente resposta fora do escopo: chame <transferir_atendimento> e depois avise que um humano vai continuar.
`
}
