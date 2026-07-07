import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import type {
  CampanhaRow,
  CampanhaStatusCriacao,
  CampanhaTipoMensagem,
  CriarCampanhaResponse,
} from '#shared/types/disparoEmMassa'
import { assertMethod, createError, readBody } from 'h3'
import { checkChannels } from '../../../utils/checkChannel'
import { checkWorkspace } from '../../../utils/checkWorkspace'
import { uploadMidiaDisparoEmMassa } from '../../../utils/disparoEmMassaUploadMidia'
import { getAuthUserId } from '../../../utils/getAuthUserId'

const WEBHOOK_URL_CAMPANHA = 'https://nwebhook.construzap.com/webhook/28d7sdasd132a-ae0s444132s5'

const VIEW_KANBAN_CONVERSAS = 'view_kanban_conversas'

type Body = Record<string, unknown>
type SupabaseAdmin = ReturnType<typeof serverSupabaseServiceRole<any>>

function parseWorkspaceId(raw: unknown): number {
  const n =
    typeof raw === 'number' && Number.isInteger(raw)
      ? raw
      : Number.parseInt(String(raw ?? '').trim(), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw createError({ statusCode: 400, statusMessage: 'workspace_id inválido.' })
  }
  return n
}

function parseCanalId(raw: unknown): number {
  const n =
    typeof raw === 'number' && Number.isInteger(raw)
      ? raw
      : Number.parseInt(String(raw ?? '').trim(), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw createError({ statusCode: 400, statusMessage: 'canal_id inválido.' })
  }
  return n
}

function parseTipoMensagem(raw: unknown): CampanhaTipoMensagem {
  const s = String(raw ?? '').trim().toLowerCase()
  if (s === 'texto' || s === 'imagem' || s === 'audio') return s
  throw createError({ statusCode: 400, statusMessage: 'tipo_mensagem deve ser texto, imagem ou audio.' })
}

function parseCampanhaStatus(raw: unknown): CampanhaStatusCriacao {
  const s = String(raw ?? '').trim().toLowerCase()
  if (s === 'rascunho' || s === 'processando') return s
  throw createError({ statusCode: 400, statusMessage: 'status deve ser rascunho ou processando.' })
}

function parseIaLigada(raw: unknown): boolean {
  if (typeof raw === 'boolean') return raw
  if (raw === 'true' || raw === 1 || raw === '1') return true
  if (raw === 'false' || raw === 0 || raw === '0') return false
  throw createError({ statusCode: 400, statusMessage: 'ia_ligada é obrigatório (true ou false).' })
}

function parseEnviaParaGrupo(raw: unknown): boolean {
  if (raw === undefined || raw === null || raw === '') return false
  if (typeof raw === 'boolean') return raw
  if (raw === 'true' || raw === 1 || raw === '1') return true
  if (raw === 'false' || raw === 0 || raw === '0') return false
  throw createError({ statusCode: 400, statusMessage: 'envia_para_grupo inválido (true ou false).' })
}

function parseFonteCanaisIds(body: Body): number[] {
  const raw = body.fonte_canais_ids
  if (Array.isArray(raw)) {
    const ids = raw.map((item) => {
      const n = typeof item === 'number' ? item : Number.parseInt(String(item ?? '').trim(), 10)
      if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
        throw createError({ statusCode: 400, statusMessage: 'fonte_canais_ids contém id inválido.' })
      }
      return n
    })
    return [...new Set(ids)]
  }

  const legacy = body.fonte_canal_id
  if (legacy === undefined || legacy === null || legacy === '') return []

  const parts = String(legacy)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const ids: number[] = []
  for (const part of parts) {
    const n = Number.parseInt(part, 10)
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
      throw createError({ statusCode: 400, statusMessage: 'fonte_canal_id inválido.' })
    }
    ids.push(n)
  }
  return [...new Set(ids)]
}

function serializarFonteCanalId(ids: number[]): string | null {
  if (ids.length === 0) return null
  return ids.join(',')
}

function parseVisualizacaoUnica(raw: unknown): boolean {
  if (raw === undefined || raw === null || raw === '') return false
  if (typeof raw === 'boolean') return raw
  if (raw === 'true' || raw === 1 || raw === '1') return true
  if (raw === 'false' || raw === 0 || raw === '0') return false
  throw createError({ statusCode: 400, statusMessage: 'visualizacao_unica inválido (true ou false).' })
}

function visualizacaoUnicaDaCampanha(
  tipo_mensagem: CampanhaTipoMensagem,
  raw: unknown,
): boolean {
  if (tipo_mensagem === 'texto') return false
  return parseVisualizacaoUnica(raw)
}

function trimOrNull(raw: unknown): string | null {
  const t = String(raw ?? '').trim()
  return t.length > 0 ? t : null
}

function parseIntervaloMinutos(raw: unknown, campo: string): number {
  if (raw === undefined || raw === null || raw === '') {
    throw createError({ statusCode: 400, statusMessage: `${campo} é obrigatório.` })
  }
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw createError({ statusCode: 400, statusMessage: `${campo} inválido (mínimo 1).` })
  }
  return n
}

function parseCanaisIds(body: Body): number[] {
  const raw = body.canais_ids
  if (Array.isArray(raw) && raw.length > 0) {
    const ids = raw.map((item) => {
      const n = typeof item === 'number' ? item : Number.parseInt(String(item ?? '').trim(), 10)
      if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
        throw createError({ statusCode: 400, statusMessage: 'canais_ids contém id inválido.' })
      }
      return n
    })
    return [...new Set(ids)]
  }

  if (body.canal_id !== undefined && body.canal_id !== null && body.canal_id !== '') {
    return [parseCanalId(body.canal_id)]
  }

  throw createError({ statusCode: 400, statusMessage: 'Informe ao menos um canal em canais_ids.' })
}

function parseColunaIds(raw: unknown): number[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Informe ao menos uma coluna em coluna_ids.' })
  }
  const ids = raw.map((item) => {
    const n = typeof item === 'number' ? item : Number.parseInt(String(item ?? '').trim(), 10)
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
      throw createError({ statusCode: 400, statusMessage: 'coluna_ids contém id inválido.' })
    }
    return n
  })
  return [...new Set(ids)]
}

/** Coluna destino após o disparo (`null` = não mover). */
function parseColunaIdAposDisparo(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === '') return null
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw).trim(), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw createError({ statusCode: 400, statusMessage: 'coluna_id inválido.' })
  }
  return n
}

function parseHoraPermitida(raw: unknown, campo: string): string {
  if (raw === undefined || raw === null || raw === '') {
    throw createError({ statusCode: 400, statusMessage: `${campo} é obrigatório.` })
  }
  const s = String(raw).trim()
  const matchCurto = /^(\d{1,2}):(\d{2})$/.exec(s)
  if (matchCurto) {
    const h = Number(matchCurto[1])
    const m = Number(matchCurto[2])
    if (h < 0 || h > 23 || m < 0 || m > 59) {
      throw createError({ statusCode: 400, statusMessage: `${campo} inválido.` })
    }
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`
  }
  const matchLongo = /^(\d{1,2}):(\d{2}):(\d{2})$/.exec(s)
  if (matchLongo) {
    const h = Number(matchLongo[1])
    const m = Number(matchLongo[2])
    const sec = Number(matchLongo[3])
    if (h < 0 || h > 23 || m < 0 || m > 59 || sec < 0 || sec > 59) {
      throw createError({ statusCode: 400, statusMessage: `${campo} inválido.` })
    }
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }
  throw createError({ statusCode: 400, statusMessage: `${campo} inválido (use HH:mm).` })
}

function minutosDesdeMeiaNoiteHora(hora: string): number {
  const match = /^(\d{1,2}):(\d{2})/.exec(hora)
  if (!match) return Number.NaN
  return Number(match[1]) * 60 + Number(match[2])
}

function parseDataInicio(dataLocal: string | null, horaLocal: string | null): string {
  if (!dataLocal) {
    throw createError({ statusCode: 400, statusMessage: 'data_local é obrigatória.' })
  }
  if (!horaLocal || !/^\d{1,2}:\d{2}$/.test(horaLocal)) {
    throw createError({ statusCode: 400, statusMessage: 'hora_local é obrigatória.' })
  }
  const d = new Date(`${dataLocal}T${horaLocal}:00`)
  if (Number.isNaN(d.getTime())) {
    throw createError({ statusCode: 400, statusMessage: 'data_local ou hora_local inválida.' })
  }
  return d.toISOString()
}

function safeMime(raw: unknown): string {
  const s = typeof raw === 'string' ? raw.trim() : ''
  return (s.split(';')[0] ?? '').trim().toLowerCase()
}

function aplicarFiltroIsGroupDestinatarios<
  T extends { or: (filters: string) => T },
>(query: T, enviaParaGrupo: boolean): T {
  if (enviaParaGrupo) return query
  return query.or('is_group.is.null,is_group.eq.false')
}

/** Destinatários via `view_kanban_conversas` (coluna + canal fonte + grupos). */
async function buscarConversasKeys(
  admin: SupabaseAdmin,
  workspaceId: number,
  colunaIds: number[],
  fonteCanaisIds: number[],
  enviaParaGrupo: boolean,
): Promise<string[]> {
  let query = admin
    .from(VIEW_KANBAN_CONVERSAS)
    .select('conversa_key')
    .eq('workspace_id', workspaceId)
    .in('coluna_id', colunaIds)
    .in('id_canal', fonteCanaisIds)

  query = aplicarFiltroIsGroupDestinatarios(query, enviaParaGrupo)

  const { data, error } = await query

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const keys = new Set<string>()
  for (const row of (data ?? []) as Array<{ conversa_key?: unknown }>) {
    const key = String(row.conversa_key ?? '').trim()
    if (key) keys.add(key)
  }

  return [...keys]
}

/**
 * POST /api/kanban/disparo_em_massa
 *
 * Cria campanha em `campanhas` e retorna as conversas para enfileirar em lotes no cliente.
 * Destinatários resolvidos via `view_kanban_conversas`.
 */
export default defineEventHandler(async (event): Promise<CriarCampanhaResponse> => {
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

  const body = (await readBody<Body>(event).catch(() => null)) ?? {}
  const workspaceId = parseWorkspaceId(body.workspace_id)
  await checkWorkspace(event, workspaceId, userId)

  const nome = trimOrNull(body.nome)
  if (!nome) {
    throw createError({ statusCode: 400, statusMessage: 'nome é obrigatório.' })
  }

  const tipo_mensagem = parseTipoMensagem(body.tipo_mensagem)
  const status = parseCampanhaStatus(body.status)
  const ia_ligada = parseIaLigada(body.ia_ligada)
  const visualizacao_unica = visualizacaoUnicaDaCampanha(tipo_mensagem, body.visualizacao_unica)
  const conteudo_texto = trimOrNull(body.conteudo_texto)
  const canais_ids = parseCanaisIds(body)
  const canal_id = canais_ids[0]!
  const coluna_ids = parseColunaIds(body.coluna_ids)
  const coluna_id = parseColunaIdAposDisparo(body.coluna_id)
  const fonte_canais_ids = parseFonteCanaisIds(body)
  const fonte_canal_id = serializarFonteCanalId(fonte_canais_ids)
  const envia_para_grupo = parseEnviaParaGrupo(body.envia_para_grupo)

  const intervalo_minimo_minutos = parseIntervaloMinutos(
    body.intervalo_minimo_minutos,
    'intervalo_minimo_minutos',
  )
  const intervalo_maximo_minutos = parseIntervaloMinutos(
    body.intervalo_maximo_minutos,
    'intervalo_maximo_minutos',
  )

  if (intervalo_minimo_minutos > intervalo_maximo_minutos) {
    throw createError({
      statusCode: 400,
      statusMessage: 'intervalo_minimo_minutos não pode ser maior que intervalo_maximo_minutos.',
    })
  }

  const canaisOk = await checkChannels(event, canais_ids, userId)
  if (!canaisOk) {
    throw createError({ statusCode: 403, statusMessage: 'Canal inválido ou sem permissão.' })
  }

  if (fonte_canais_ids.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Selecione ao menos um canal fonte para buscar destinatários.',
    })
  }

  const fonteCanaisOk = await checkChannels(event, fonte_canais_ids, userId)
  if (!fonteCanaisOk) {
    throw createError({ statusCode: 403, statusMessage: 'Canal fonte inválido ou sem permissão.' })
  }

  if (tipo_mensagem === 'texto' && !conteudo_texto) {
    throw createError({ statusCode: 400, statusMessage: 'conteudo_texto é obrigatório para mensagem de texto.' })
  }

  const admin = serverSupabaseServiceRole<any>(event)

  const conversaKeys = await buscarConversasKeys(
    admin,
    workspaceId,
    coluna_ids,
    fonte_canais_ids,
    envia_para_grupo,
  )
  const total_contatos = conversaKeys.length

  let url_midia: string | null = null

  if (tipo_mensagem === 'imagem' || tipo_mensagem === 'audio') {
    const data_base64 = typeof body.data_base64 === 'string' ? body.data_base64.trim() : ''
    if (!data_base64) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Informe data_base64 para campanha com imagem ou áudio.',
      })
    }
    const mime = safeMime(body.mime)
    if (!mime) {
      throw createError({ statusCode: 400, statusMessage: 'mime é obrigatório para imagem ou áudio.' })
    }
    url_midia = await uploadMidiaDisparoEmMassa({
      workspaceId,
      mensagem_type: tipo_mensagem,
      mime,
      data_base64,
    })
  }

  const data_local = trimOrNull(body.data_local)
  const hora_local = trimOrNull(body.hora_local)
  const data_inicio = parseDataInicio(data_local, hora_local)

  const hora_permitida_inicio = parseHoraPermitida(
    body.hora_permitida_inicio,
    'hora_permitida_inicio',
  )
  const hora_permitida_fim = parseHoraPermitida(body.hora_permitida_fim, 'hora_permitida_fim')
  if (
    minutosDesdeMeiaNoiteHora(hora_permitida_inicio) >= minutosDesdeMeiaNoiteHora(hora_permitida_fim)
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: 'hora_permitida_inicio deve ser anterior a hora_permitida_fim.',
    })
  }

  const insertCampanha: Record<string, unknown> = {
    nome,
    tipo_mensagem,
    conteudo_texto,
    url_midia,
    webhook_url: WEBHOOK_URL_CAMPANHA,
    intervalo_minimo_minutos,
    intervalo_maximo_minutos,
    status,
    canal_id,
    canais_ids,
    ultimo_canal_id: null,
    data_inicio,
    total_contatos,
    total_enviados: 0,
    proximo_disparo: null,
    ia_ligada,
    visualizacao_unica,
    hora_permitida_inicio,
    hora_permitida_fim,
    fonte_canal_id,
    envia_para_grupo,
    coluna_id,
  }

  const { data: campanhaInsert, error: campanhaErr } = await admin
    .from('campanhas')
    .insert(insertCampanha)
    .select(
      'id, nome, tipo_mensagem, conteudo_texto, url_midia, webhook_url, intervalo_minimo_minutos, intervalo_maximo_minutos, status, criado_em, canal_id, canais_ids, ultimo_canal_id, data_inicio, total_contatos, total_enviados, proximo_disparo, ia_ligada, visualizacao_unica, hora_permitida_inicio, hora_permitida_fim, fonte_canal_id, envia_para_grupo, coluna_id',
    )
    .single()

  if (campanhaErr || !campanhaInsert) {
    throw createError({
      statusCode: 500,
      statusMessage: campanhaErr?.message ?? 'Não foi possível criar a campanha.',
    })
  }

  const campanha = campanhaInsert as CampanhaRow

  return {
    campanha,
    conversa_keys: conversaKeys,
  }
})
