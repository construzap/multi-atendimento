import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import type {
  CriarMensagemProntaResponse,
  MensagemProntaPasso,
  MensagemProntaSequenciaResumo,
} from '#shared/types/mensagensProntas'
import { checkWorkspace } from '../../utils/checkWorkspace'
import { getAuthUserId } from '../../utils/getAuthUserId'
import {
  assertColunaDestinoDoWorkspace,
  mapColunaDestinoId,
  mapFecharPedidoEmAberto,
  mapIaLigada,
  parseFecharPedidoEmAbertoBody,
  parseIaLigadaBody,
  parseOptionalColunaDestinoId,
} from '../../utils/mensagensProntasColunaDestino'
import {
  MENSAGEM_PRONTA_PASSOS_SELECT,
  mapPassoFromDbRow,
  parsePassos,
  passoInsertRow,
} from '../../utils/mensagensProntasPassos'
import { parsePositiveInt } from '../../utils/parsePositiveInt'

type Body = {
  workspace_id?: unknown
  nome?: unknown
  passos?: unknown
  coluna_destino_id?: unknown
  ia_ligada?: unknown
  fechar_pedido_em_aberto?: unknown
}

function strRequired(raw: unknown, label: string): string {
  const s = typeof raw === 'string' ? raw.trim() : String(raw ?? '').trim()
  if (!s) {
    throw createError({ statusCode: 400, statusMessage: `${label} é obrigatório.` })
  }
  return s
}

/**
 * POST /api/mensagens_prontas
 * Body: `{ workspace_id, nome, passos[], coluna_destino_id?, ia_ligada?, fechar_pedido_em_aberto? }`
 * Cria sequência + passos em `mensagens_prontas_sequencias` / `mensagens_prontas_passos`.
 */
export default defineEventHandler(async (event): Promise<CriarMensagemProntaResponse> => {
  assertMethod(event, 'POST')

  const client = await serverSupabaseClient(event)
  const { data: authData, error: authError } = await client.auth.getUser()
  if (authError || !authData.user) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const userId = getAuthUserId(authData.user)
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const body = (await readBody(event).catch(() => null)) as Body | null
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Body JSON inválido.' })
  }

  const workspaceId = parsePositiveInt(body.workspace_id, 'workspace_id')
  const nome = strRequired(body.nome, 'Nome')
  const passos = parsePassos(body.passos)
  const colunaDestinoId = parseOptionalColunaDestinoId(body.coluna_destino_id)
  const iaLigada = parseIaLigadaBody(body.ia_ligada)
  const fecharPedidoEmAberto = parseFecharPedidoEmAbertoBody(body.fechar_pedido_em_aberto)

  await checkWorkspace(event, workspaceId, userId)

  const admin = serverSupabaseServiceRole<any>(event)

  if (colunaDestinoId != null) {
    await assertColunaDestinoDoWorkspace(admin, workspaceId, colunaDestinoId)
  }

  const { data: sequencia, error: seqErr } = await admin
    .from('mensagens_prontas_sequencias')
    .insert({
      nome,
      workspace_id: workspaceId,
      user_id: userId,
      coluna_destino_id: colunaDestinoId,
      ia_ligada: iaLigada,
      fechar_pedido_em_aberto: fecharPedidoEmAberto,
    })
    .select(
      'id, nome, workspace_id, user_id, created_at, coluna_destino_id, ia_ligada, fechar_pedido_em_aberto',
    )
    .maybeSingle()

  if (seqErr) {
    throw createError({ statusCode: 500, statusMessage: seqErr.message })
  }
  if (!sequencia?.id) {
    throw createError({ statusCode: 500, statusMessage: 'Falha ao criar a sequência.' })
  }

  const sequenciaId = String(sequencia.id)
  const rowsPassos = passos.map((p) => passoInsertRow(sequenciaId, p))

  const { data: passosCriados, error: passosErr } = await admin
    .from('mensagens_prontas_passos')
    .insert(rowsPassos)
    .select(MENSAGEM_PRONTA_PASSOS_SELECT)
    .order('ordem', { ascending: true })

  if (passosErr) {
    // rollback manual da sequência
    await admin.from('mensagens_prontas_sequencias').delete().eq('id', sequenciaId)
    throw createError({ statusCode: 500, statusMessage: passosErr.message })
  }

  const sequenciaOut: MensagemProntaSequenciaResumo = {
    id: sequenciaId,
    nome: String(sequencia.nome ?? nome),
    workspace_id:
      typeof sequencia.workspace_id === 'number'
        ? sequencia.workspace_id
        : Number(sequencia.workspace_id),
    user_id: String(sequencia.user_id ?? userId),
    created_at: String(sequencia.created_at ?? new Date().toISOString()),
    coluna_destino_id: mapColunaDestinoId(sequencia.coluna_destino_id),
    ia_ligada: mapIaLigada(sequencia.ia_ligada),
    fechar_pedido_em_aberto: mapFecharPedidoEmAberto(sequencia.fechar_pedido_em_aberto),
  }

  const passosOut: MensagemProntaPasso[] = (passosCriados ?? []).map((row: Record<string, unknown>) =>
    mapPassoFromDbRow(row),
  )

  return {
    ok: true,
    sequencia: sequenciaOut,
    passos: passosOut,
  }
})
