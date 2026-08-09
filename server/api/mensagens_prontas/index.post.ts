import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import type {
  CriarMensagemProntaResponse,
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
  parseOptionalColunaDestinoId,
} from '../../utils/mensagensProntasColunaDestino'
import { parsePositiveInt } from '../../utils/parsePositiveInt'

type Body = {
  workspace_id?: unknown
  nome?: unknown
  passos?: unknown
  coluna_destino_id?: unknown
}

const TIPOS: MensagemProntaTipo[] = ['texto', 'audio', 'imagem', 'video', 'documento']

function strRequired(raw: unknown, label: string): string {
  const s = typeof raw === 'string' ? raw.trim() : String(raw ?? '').trim()
  if (!s) {
    throw createError({ statusCode: 400, statusMessage: `${label} é obrigatório.` })
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
 * POST /api/mensagens_prontas
 * Body: `{ workspace_id, nome, passos[], coluna_destino_id? }`
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
    })
    .select('id, nome, workspace_id, user_id, created_at, coluna_destino_id')
    .maybeSingle()

  if (seqErr) {
    throw createError({ statusCode: 500, statusMessage: seqErr.message })
  }
  if (!sequencia?.id) {
    throw createError({ statusCode: 500, statusMessage: 'Falha ao criar a sequência.' })
  }

  const sequenciaId = String(sequencia.id)
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
