import type { H3Event } from 'h3'
import { createError } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { MensagemProntaComPassos, MensagemProntaPasso } from '#shared/types/mensagensProntas'
import type { PusherKanbanAtualizacaoPayload } from '#shared/types/kanban'
import { resolverMensagemProntaParaEnvio } from '#shared/utils/mensagemProntaVariaveis'
import { triggerKanbanAtualizacao } from './pusherServer'
import type { NotificacaoEntregaRow } from './entregaPublica'
import { MENSAGEM_PRONTA_PASSOS_SELECT, MENSAGEM_PRONTA_TIPOS, mapPassoFromDbRow } from './mensagensProntasPassos'

/** Funil principal do workspace (ordem 1). */
export const ENTREGA_FUNIL_ORDEM = 1
/** Coluna destino ao coletar (ordem 5). */
export const ENTREGA_COLUNA_ORDEM_COLETA = 5
/** Coluna destino ao chegar no local (ordem 6). */
export const ENTREGA_COLUNA_ORDEM_NO_LOCAL = 6
/** Coluna destino ao confirmar entrega (ordem 7). */
export const ENTREGA_COLUNA_ORDEM_ENTREGUE = 7

export type EntregaEtapaKanban = 'coletado' | 'no_local' | 'entregue'

export function colunaOrdemDaEtapa(etapa: EntregaEtapaKanban): number {
  switch (etapa) {
    case 'coletado':
      return ENTREGA_COLUNA_ORDEM_COLETA
    case 'no_local':
      return ENTREGA_COLUNA_ORDEM_NO_LOCAL
    case 'entregue':
      return ENTREGA_COLUNA_ORDEM_ENTREGUE
  }
}

const WEBHOOK_MENSAGEM_PRONTA_N8N =
  'https://nwebhook.construzap.com/webhook/muster-septum-cuddly0-magnesium'

export type EntregaColetaResolucao = {
  workspace_id: number
  conversa_key: string
  funil_id: number
  coluna_id: number
  id_agendamento_mensagem: string | null
  canal_id: number | null
}

export type EntregaAoColetarResult = EntregaColetaResolucao & {
  coluna_ordem: number
  etapa: EntregaEtapaKanban
  conversa_atualizada: boolean
  webhook_disparado: boolean
  webhook_erro: string | null
  pusher_ok: boolean
}

/**
 * Resolve funil (ordem 1) + coluna (ordem informada) do workspace.
 */
export async function resolverFunilColunaPorOrdem(
  event: H3Event,
  workspaceId: number,
  colunaOrdem: number,
): Promise<{
  funil_id: number
  coluna_id: number
  id_agendamento_mensagem: string | null
  coluna_ordem: number
}> {
  const admin = serverSupabaseServiceRole<any>(event)

  const { data: funil, error: funilErr } = await admin
    .from('funil_workspace')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('ordem', ENTREGA_FUNIL_ORDEM)
    .maybeSingle()

  if (funilErr) {
    throw createError({ statusCode: 500, statusMessage: funilErr.message })
  }
  if (!funil) {
    throw createError({
      statusCode: 404,
      statusMessage: `Funil com ordem ${ENTREGA_FUNIL_ORDEM} não encontrado neste workspace.`,
    })
  }

  const funilId = typeof funil.id === 'number' ? funil.id : Number.parseInt(String(funil.id), 10)
  if (!Number.isFinite(funilId) || funilId < 1) {
    throw createError({ statusCode: 500, statusMessage: 'Funil inválido.' })
  }

  const { data: coluna, error: colErr } = await admin
    .from('funil_workspace_colunas')
    .select('id, id_agendamento_mensagem')
    .eq('workspace_id', workspaceId)
    .eq('funil_id', funilId)
    .eq('ordem', colunaOrdem)
    .is('deleted_at', null)
    .maybeSingle()

  if (colErr) {
    throw createError({ statusCode: 500, statusMessage: colErr.message })
  }
  if (!coluna) {
    throw createError({
      statusCode: 404,
      statusMessage: `Coluna com ordem ${colunaOrdem} não encontrada neste funil.`,
    })
  }

  const colunaId =
    typeof coluna.id === 'number' ? coluna.id : Number.parseInt(String(coluna.id), 10)
  if (!Number.isFinite(colunaId) || colunaId < 1) {
    throw createError({ statusCode: 500, statusMessage: 'Coluna inválida.' })
  }

  const agRaw = coluna.id_agendamento_mensagem
  const id_agendamento_mensagem =
    agRaw != null && String(agRaw).trim()
      ? String(agRaw).trim()
      : null

  return {
    funil_id: funilId,
    coluna_id: colunaId,
    id_agendamento_mensagem,
    coluna_ordem: colunaOrdem,
  }
}

/** @deprecated Preferir `resolverFunilColunaPorOrdem` com ordem explícita. */
export async function resolverFunilColunaColeta(
  event: H3Event,
  workspaceId: number,
): Promise<{
  funil_id: number
  coluna_id: number
  id_agendamento_mensagem: string | null
}> {
  const r = await resolverFunilColunaPorOrdem(event, workspaceId, ENTREGA_COLUNA_ORDEM_COLETA)
  return {
    funil_id: r.funil_id,
    coluna_id: r.coluna_id,
    id_agendamento_mensagem: r.id_agendamento_mensagem,
  }
}

async function carregarMensagemPronta(
  event: H3Event,
  workspaceId: number,
  sequenciaId: string,
): Promise<MensagemProntaComPassos | null> {
  const admin = serverSupabaseServiceRole<any>(event)

  const { data: seq, error: seqErr } = await admin
    .from('mensagens_prontas_sequencias')
    .select(
      'id, nome, workspace_id, user_id, created_at, coluna_destino_id, ia_ligada, fechar_pedido_em_aberto',
    )
    .eq('id', sequenciaId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (seqErr) {
    throw createError({ statusCode: 500, statusMessage: seqErr.message })
  }
  if (!seq) return null

  const { data: passosRows, error: passosErr } = await admin
    .from('mensagens_prontas_passos')
    .select(MENSAGEM_PRONTA_PASSOS_SELECT)
    .eq('sequencia_id', sequenciaId)
    .order('ordem', { ascending: true })

  if (passosErr) {
    throw createError({ statusCode: 500, statusMessage: passosErr.message })
  }

  const passos: MensagemProntaPasso[] = (passosRows ?? []).map((row: Record<string, unknown>) => {
    const passo = mapPassoFromDbRow(row)
    if (!(MENSAGEM_PRONTA_TIPOS as string[]).includes(passo.tipo)) {
      return { ...passo, tipo: 'texto' }
    }
    return passo
  })

  if (passos.length === 0) return null

  const colDestRaw = seq.coluna_destino_id
  let coluna_destino_id: number | null = null
  if (colDestRaw != null && String(colDestRaw).trim() !== '') {
    const n =
      typeof colDestRaw === 'number' ? colDestRaw : Number.parseInt(String(colDestRaw), 10)
    if (Number.isFinite(n) && n >= 1) coluna_destino_id = n
  }

  return {
    sequencia: {
      id: String(seq.id),
      nome: String(seq.nome ?? ''),
      workspace_id:
        typeof seq.workspace_id === 'number'
          ? seq.workspace_id
          : Number.parseInt(String(seq.workspace_id), 10),
      user_id: String(seq.user_id ?? ''),
      created_at: String(seq.created_at ?? new Date().toISOString()),
      coluna_destino_id,
      ia_ligada: !(
        seq.ia_ligada === false ||
        seq.ia_ligada === 'false' ||
        seq.ia_ligada === 0 ||
        seq.ia_ligada === '0'
      ),
      fechar_pedido_em_aberto:
        seq.fechar_pedido_em_aberto === true ||
        seq.fechar_pedido_em_aberto === 'true' ||
        seq.fechar_pedido_em_aberto === 1 ||
        seq.fechar_pedido_em_aberto === '1',
    },
    passos,
  }
}

async function dispararWebhookAgendamento(input: {
  workspaceId: number
  canalId: number
  conversaKey: string
  phone: string | null
  name: string | null
  mensagem: MensagemProntaComPassos
}): Promise<void> {
  const mensagem_pronta = resolverMensagemProntaParaEnvio(input.mensagem, input.name)
  const coluna_destino_id = mensagem_pronta.sequencia.coluna_destino_id ?? null
  const payload = {
    workspace_id: input.workspaceId,
    canal_id: input.canalId,
    conversa_key: input.conversaKey,
    phone: input.phone,
    name: input.name,
    mensagem_pronta,
    coluna_destino_id,
    mover_contato: coluna_destino_id != null,
    ia_ligada: mensagem_pronta.sequencia.ia_ligada !== false,
    fechar_pedido_em_aberto: mensagem_pronta.sequencia.fechar_pedido_em_aberto === true,
  }

  let res: Response
  try {
    res = await fetch(WEBHOOK_MENSAGEM_PRONTA_N8N, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'falha de rede'
    throw new Error(`Webhook N8N inacessível: ${msg}`)
  }

  if (!res.ok) {
    throw new Error(`Webhook N8N retornou HTTP ${res.status}`)
  }
}

/**
 * Move a conversa no funil ordem 1 para a coluna da etapa
 * (5=coletado, 6=no_local, 7=entregue) e dispara agendamento se houver.
 */
export async function executarAutomacaoEtapaKanban(
  event: H3Event,
  row: NotificacaoEntregaRow,
  etapa: EntregaEtapaKanban,
): Promise<EntregaAoColetarResult> {
  const colunaOrdem = colunaOrdemDaEtapa(etapa)
  const resolvido = await resolverFunilColunaPorOrdem(event, row.workspace_id, colunaOrdem)
  const admin = serverSupabaseServiceRole<any>(event)
  const nowIso = new Date().toISOString()

  const { data: conversaAntes, error: convFindErr } = await admin
    .from('conversas')
    .select('key, workspace_id, id_canal, name, phone, lid')
    .eq('key', row.conversa_key)
    .eq('workspace_id', row.workspace_id)
    .is('deleted_at', null)
    .maybeSingle()

  if (convFindErr) {
    throw createError({ statusCode: 500, statusMessage: convFindErr.message })
  }
  if (!conversaAntes) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Conversa do pedido não encontrada neste workspace.',
    })
  }

  const { data: updated, error: upErr } = await admin
    .from('conversas')
    .update({
      coluna_id: resolvido.coluna_id,
      funil_id: resolvido.funil_id,
      updated_at: nowIso,
    })
    .eq('key', row.conversa_key)
    .eq('workspace_id', row.workspace_id)
    .is('deleted_at', null)
    .select('key, id_canal')
    .maybeSingle()

  if (upErr) {
    throw createError({ statusCode: 500, statusMessage: upErr.message })
  }
  if (!updated) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Não foi possível atualizar a conversa.',
    })
  }

  const canalIdFromConv =
    typeof conversaAntes.id_canal === 'number'
      ? conversaAntes.id_canal
      : Number.parseInt(String(conversaAntes.id_canal ?? ''), 10)
  const canal_id =
    row.canal_id != null && row.canal_id >= 1
      ? row.canal_id
      : Number.isFinite(canalIdFromConv) && canalIdFromConv >= 1
        ? canalIdFromConv
        : null

  let webhook_disparado = false
  let webhook_erro: string | null = null

  if (resolvido.id_agendamento_mensagem && canal_id != null) {
    try {
      const mensagem = await carregarMensagemPronta(
        event,
        row.workspace_id,
        resolvido.id_agendamento_mensagem,
      )
      if (!mensagem) {
        webhook_erro = 'Sequência de agendamento não encontrada ou sem passos.'
      } else {
        const phone =
          conversaAntes.phone != null && String(conversaAntes.phone).trim()
            ? String(conversaAntes.phone).trim()
            : conversaAntes.lid != null && String(conversaAntes.lid).trim()
              ? String(conversaAntes.lid).trim()
              : null
        const name =
          conversaAntes.name != null && String(conversaAntes.name).trim()
            ? String(conversaAntes.name).trim()
            : null
        await dispararWebhookAgendamento({
          workspaceId: row.workspace_id,
          canalId: canal_id,
          conversaKey: row.conversa_key,
          phone,
          name,
          mensagem,
        })
        webhook_disparado = true
      }
    } catch (e) {
      webhook_erro = e instanceof Error ? e.message : 'Falha ao disparar webhook.'
      console.warn('[entregaKanban] webhook:', webhook_erro)
    }
  }

  let pusher_ok = false
  if (canal_id != null) {
    try {
      const payload: PusherKanbanAtualizacaoPayload = {
        workspace_id: row.workspace_id,
        conversa_key: row.conversa_key,
        id_canal: canal_id,
        coluna_id: resolvido.coluna_id,
        funil_id: resolvido.funil_id,
        nome_contato:
          conversaAntes.name != null && String(conversaAntes.name).trim()
            ? String(conversaAntes.name).trim()
            : null,
        notificacao: null,
        motivo: 'coluna',
      }
      await triggerKanbanAtualizacao(event, canal_id, payload)
      pusher_ok = true
    } catch (e) {
      console.warn(
        '[entregaKanban] pusher:',
        e instanceof Error ? e.message : e,
      )
    }
  }

  return {
    workspace_id: row.workspace_id,
    conversa_key: row.conversa_key,
    funil_id: resolvido.funil_id,
    coluna_id: resolvido.coluna_id,
    id_agendamento_mensagem: resolvido.id_agendamento_mensagem,
    canal_id,
    coluna_ordem: resolvido.coluna_ordem,
    etapa,
    conversa_atualizada: true,
    webhook_disparado,
    webhook_erro,
    pusher_ok,
  }
}

/** Atalho: automação da etapa coleta (coluna ordem 5). */
export async function executarAutomacaoAoColetar(
  event: H3Event,
  row: NotificacaoEntregaRow,
): Promise<EntregaAoColetarResult> {
  return executarAutomacaoEtapaKanban(event, row, 'coletado')
}
