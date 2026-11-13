import type { MensagemNormalizada } from '#shared/types/webhook'
import {
  mensagemAtivaFollowUpPorPalavras,
  normalizarConfigFollowUp,
  textoMensagemParaAtivacaoFollowUp,
} from '#shared/utils/validarCanalCamposExtras'
import {
  buscarCicloAtivo,
  cancelarCicloAtivo,
  criarCiclo,
  marcarCicloRespondido,
} from './followup_ciclos'
import {
  cancelarEtapasProgramadas,
  criarEtapasDoCiclo,
  maiorEtapaEnviada,
  passosConfigOrdenados,
} from './followup_etapas'

type SupabaseAdmin = ReturnType<
  typeof import('#supabase/server').serverSupabaseServiceRole<any>
>

export type AplicarFollowupNoWebhookInput = {
  conversa_key: string
  workspace_id: number | null
  canal_id: number
  mensagem_uuid: string | null
  normalizada: MensagemNormalizada
  config_follow_up?: unknown
  palavras_ativacao_follow_up?: unknown
}

/**
 * Orquestra ciclos/etapas após persistir a mensagem do webhook.
 * Falhas devem ser tratadas pelo caller (warn, não quebrar o webhook).
 */
export async function aplicarFollowupNoWebhook(
  admin: SupabaseAdmin,
  input: AplicarFollowupNoWebhookInput,
): Promise<void> {
  const conversa_key = input.conversa_key.trim()
  if (!conversa_key) return

  const { normalizada } = input

  // Mensagem da I.A.: não mexe em ciclos.
  if (normalizada.from_me && normalizada.from_ia) {
    return
  }

  // Cliente respondeu.
  if (!normalizada.from_me) {
    await marcarRespondidoSeHouverCiclo(admin, {
      conversa_key,
      mensagem_uuid: input.mensagem_uuid,
    })
    return
  }

  // Vendedor (from_me sem IA): reinicia ciclo se houver config com etapas.
  if (input.config_follow_up === undefined) return
  if (input.workspace_id == null || !Number.isFinite(input.workspace_id)) return

  const texto = textoMensagemParaAtivacaoFollowUp({
    message: normalizada.message,
    caption: normalizada.caption,
  })
  if (!mensagemAtivaFollowUpPorPalavras(texto, input.palavras_ativacao_follow_up)) {
    return
  }

  const config = normalizarConfigFollowUp(input.config_follow_up)
  const passos = passosConfigOrdenados(config)
  if (!passos.length) return

  const ativo = await buscarCicloAtivo(admin, conversa_key)
  if (ativo) {
    await cancelarCicloAtivo(admin, ativo)
  }

  const ciclo = await criarCiclo(admin, {
    workspace_id: input.workspace_id,
    conversa_key,
    canal_id: input.canal_id,
    mensagem_gatilho_id: input.mensagem_uuid,
    total_etapas: passos.length,
  })

  await criarEtapasDoCiclo(admin, {
    ciclo_id: ciclo.id,
    workspace_id: input.workspace_id,
    config,
  })
}

async function marcarRespondidoSeHouverCiclo(
  admin: SupabaseAdmin,
  input: { conversa_key: string; mensagem_uuid: string | null },
): Promise<void> {
  const ativo = await buscarCicloAtivo(admin, input.conversa_key)
  if (!ativo) return

  const enviadas = await maiorEtapaEnviada(admin, ativo.id)

  await marcarCicloRespondido(admin, ativo, {
    resposta_mensagem_id: input.mensagem_uuid,
    etapa_resposta: enviadas.etapa_resposta,
    total_enviadas: enviadas.total_enviadas,
  })

  await cancelarEtapasProgramadas(admin, ativo.id)
}
