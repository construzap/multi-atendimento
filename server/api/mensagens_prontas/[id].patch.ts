import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, getRouterParam, readBody } from 'h3'
import type {
  AtualizarMensagemProntaResponse,
  MensagemProntaPasso,
  MensagemProntaPassoInput,
  MensagemProntaSequenciaResumo,
  MensagemProntaTipo,
} from '#shared/types/mensagensProntas'
import { checkWorkspace } from '../../utils/checkWorkspace'
import { getAuthUserId } from '../../utils/getAuthUserId'
import {
  assertColunaDestinoDoWorkspace,
  mapColunaDestinoId,
  mapIaLigada,
  parseIaLigadaBody,
  parseOptionalColunaDestinoId,
} from '../../utils/mensagensProntasColunaDestino'
import { parsePositiveInt } from '../../utils/parsePositiveInt'

type Body = {
  workspace_id?: unknown
  nome?: unknown
  passos?: unknown
  coluna_destino_id?: unknown
  ia_ligada?: unknown
}

const TIPOS: MensagemProntaTipo[] = [
  'texto',
  'audio',
  'imagem',
  'video',
  'documento',
  'figurinha',
]

function strRequired(raw: unknown, label: string): string {
  const s = typeof raw === 'string' ? raw.trim() : String(raw ?? '').trim()
  if (!s) {
    throw createError({ statusCode: 400, statusMessage: `${label} é obrigatório.` })
  }
  return s
}

function parseUuid(raw: string | undefined, label: string): string {
  const s = String(raw ?? '').trim()
  if (!s || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) {
    throw createError({ statusCode: 400, statusMessage: `${label} inválido.` })
  }
  return s
}

function parsePassos(raw: unknown): MensagemProntaPassoInput[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Informe ao menos um passo em passos[].',
    })
  }

  const out: MensagemProntaPassoInput[] = []

  for (let i = 0; i < raw.length; i++) {
    const item = raw[i]
    if (!item || typeof item !== 'object') {
      throw createError({ statusCode: 400, statusMessage: `Passo ${i + 1} inválido.` })
    }
    const o = item as Record<string, unknown>
    const tipoRaw = String(o.tipo ?? '').trim().toLowerCase()
    if (!(TIPOS as string[]).includes(tipoRaw)) {
      throw createError({
        statusCode: 400,
        statusMessage: `Tipo inválido no passo ${i + 1}. Use: ${TIPOS.join(', ')}.`,
      })
    }
    const conteudo = strRequired(o.conteudo, `Conteúdo do passo ${i + 1}`)

    const ordemRaw = o.ordem
    const ordem =
      typeof ordemRaw === 'number' && Number.isFinite(ordemRaw)
        ? Math.trunc(ordemRaw)
        : Number.parseInt(String(ordemRaw ?? i + 1), 10)
    if (!Number.isFinite(ordem) || ordem < 1) {
      throw createError({ statusCode: 400, statusMessage: `Ordem inválida no passo ${i + 1}.` })
    }

    const delayRaw = o.delay_segundos
    const delay =
      typeof delayRaw === 'number' && Number.isFinite(delayRaw)
        ? Math.max(0, Math.trunc(delayRaw))
        : Math.max(0, Number.parseInt(String(delayRaw ?? 0), 10) || 0)

    out.push({
      ordem,
      tipo: tipoRaw as MensagemProntaTipo,
      conteudo,
      delay_segundos: delay,
    })
  }

  out.sort((a, b) => a.ordem - b.ordem)
  return out
}

/**
 * PATCH /api/mensagens_prontas/:id
 * Body: `{ workspace_id, nome, passos[], coluna_destino_id?, ia_ligada? }`
 * Atualiza a capa e substitui todos os passos da sequência.
 */
export default defineEventHandler(async (event): Promise<AtualizarMensagemProntaResponse> => {
  assertMethod(event, 'PATCH')

  const client = await serverSupabaseClient(event)
  const { data: authData, error: authError } = await client.auth.getUser()
  if (authError || !authData.user) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const userId = getAuthUserId(authData.user)
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Não autenticado' })
  }

  const sequenciaId = parseUuid(getRouterParam(event, 'id'), 'id')

  const body = (await readBody(event).catch(() => null)) as Body | null
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Body JSON inválido.' })
  }

  const workspaceId = parsePositiveInt(body.workspace_id, 'workspace_id')
  const nome = strRequired(body.nome, 'Nome')
  const passos = parsePassos(body.passos)
  const colunaDestinoId = parseOptionalColunaDestinoId(body.coluna_destino_id)
  const iaLigada = parseIaLigadaBody(body.ia_ligada)

  await checkWorkspace(event, workspaceId, userId)

  const admin = serverSupabaseServiceRole<any>(event)

  if (colunaDestinoId != null) {
    await assertColunaDestinoDoWorkspace(admin, workspaceId, colunaDestinoId)
  }

  const { data: existente, error: findErr } = await admin
    .from('mensagens_prontas_sequencias')
    .select('id, workspace_id, user_id, created_at')
    .eq('id', sequenciaId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (findErr) {
    throw createError({ statusCode: 500, statusMessage: findErr.message })
  }
  if (!existente?.id) {
    throw createError({ statusCode: 404, statusMessage: 'Mensagem pronta não encontrada.' })
  }

  const { data: sequencia, error: updErr } = await admin
    .from('mensagens_prontas_sequencias')
    .update({ nome, coluna_destino_id: colunaDestinoId, ia_ligada: iaLigada })
    .eq('id', sequenciaId)
    .eq('workspace_id', workspaceId)
    .select('id, nome, workspace_id, user_id, created_at, coluna_destino_id, ia_ligada')
    .maybeSingle()

  if (updErr) {
    throw createError({ statusCode: 500, statusMessage: updErr.message })
  }
  if (!sequencia?.id) {
    throw createError({ statusCode: 500, statusMessage: 'Falha ao atualizar a sequência.' })
  }

  const { error: delPassosErr } = await admin
    .from('mensagens_prontas_passos')
    .delete()
    .eq('sequencia_id', sequenciaId)

  if (delPassosErr) {
    throw createError({ statusCode: 500, statusMessage: delPassosErr.message })
  }

  const rowsPassos = passos.map((p) => ({
    sequencia_id: sequenciaId,
    ordem: p.ordem,
    tipo: p.tipo,
    conteudo: p.conteudo,
    delay_segundos: p.delay_segundos,
  }))

  const { data: passosCriados, error: passosErr } = await admin
    .from('mensagens_prontas_passos')
    .insert(rowsPassos)
    .select('id, sequencia_id, ordem, tipo, conteudo, delay_segundos, created_at')
    .order('ordem', { ascending: true })

  if (passosErr) {
    throw createError({ statusCode: 500, statusMessage: passosErr.message })
  }

  const sequenciaOut: MensagemProntaSequenciaResumo = {
    id: sequenciaId,
    nome: String(sequencia.nome ?? nome),
    workspace_id:
      typeof sequencia.workspace_id === 'number'
        ? sequencia.workspace_id
        : Number(sequencia.workspace_id),
    user_id: String(sequencia.user_id ?? existente.user_id ?? userId),
    created_at: String(sequencia.created_at ?? existente.created_at ?? new Date().toISOString()),
    coluna_destino_id: mapColunaDestinoId(sequencia.coluna_destino_id),
    ia_ligada: mapIaLigada(sequencia.ia_ligada),
  }

  const passosOut: MensagemProntaPasso[] = (passosCriados ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    sequencia_id: String(row.sequencia_id),
    ordem: Number(row.ordem),
    tipo: String(row.tipo) as MensagemProntaTipo,
    conteudo: String(row.conteudo ?? ''),
    delay_segundos: Number(row.delay_segundos ?? 0),
    created_at: String(row.created_at ?? new Date().toISOString()),
  }))

  return {
    ok: true,
    sequencia: sequenciaOut,
    passos: passosOut,
  }
})
