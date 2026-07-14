import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import type { AtualizarCampanhaResponse, CampanhaListItem, CampanhaStatusCriacao, CampanhaTipoMensagem } from '#shared/types/disparoEmMassa'
import { isTimezoneCampanhaPermitido } from '#shared/constants/ianaTimezonesBrasil'
import { assertMethod, createError, readBody } from 'h3'
import { checkChannels } from '../../../utils/checkChannel'
import { checkWorkspace } from '../../../utils/checkWorkspace'
import { uploadMidiaDisparoEmMassa } from '../../../utils/disparoEmMassaUploadMidia'
import { getAuthUserId } from '../../../utils/getAuthUserId'

const VIEW_KANBAN_CONVERSAS = 'view_kanban_conversas'

const CAMPANHA_SELECT =
  'id, nome, tipo_mensagem, conteudo_texto, url_midia, intervalo_minimo_minutos, intervalo_maximo_minutos, status, canal_id, canais_ids, data_inicio, total_contatos, total_enviados, proximo_disparo, ia_ligada, visualizacao_unica, hora_permitida_inicio, hora_permitida_fim, fonte_canal_id, envia_para_grupo, coluna_id, funil_id, timezone_escolhido, tamanho_lote, pausa_lote_minutos, coluna_erro_id, funil_erro_id'

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

function parseCampanhaId(raw: unknown): string {
  const id = String(raw ?? '').trim()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw createError({ statusCode: 400, statusMessage: 'campanha_id inválido.' })
  }
  return id
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

function visualizacaoUnicaDaCampanha(tipo_mensagem: CampanhaTipoMensagem, raw: unknown): boolean {
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

function parseColunaIdsOpcional(raw: unknown): number[] | null {
  if (raw === undefined || raw === null) return null
  if (!Array.isArray(raw) || raw.length === 0) return null
  const ids = raw.map((item) => {
    const n = typeof item === 'number' ? item : Number.parseInt(String(item ?? '').trim(), 10)
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
      throw createError({ statusCode: 400, statusMessage: 'coluna_ids contém id inválido.' })
    }
    return n
  })
  return [...new Set(ids)]
}

function parseColunaIdAposDisparo(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === '') return null
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw).trim(), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw createError({ statusCode: 400, statusMessage: 'coluna_id inválido.' })
  }
  return n
}

function parseColunaErroId(raw: unknown): number {
  if (raw === undefined || raw === null || raw === '') {
    throw createError({ statusCode: 400, statusMessage: 'coluna_erro_id é obrigatório.' })
  }
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw).trim(), 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw createError({ statusCode: 400, statusMessage: 'coluna_erro_id inválido.' })
  }
  return n
}

function parseFunilIdOpcional(raw: unknown): string | null {
  if (raw === undefined || raw === null || raw === '') return null
  const s = String(raw).trim()
  if (!s) return null
  const n = Number.parseInt(s, 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw createError({ statusCode: 400, statusMessage: 'funil_id inválido.' })
  }
  return String(n)
}

async function resolverFunilIdDaColuna(
  admin: SupabaseAdmin,
  workspaceId: number,
  colunaId: number,
): Promise<string | null> {
  const { data: coluna, error: colErr } = await admin
    .from('funil_workspace_colunas')
    .select('funil_id')
    .eq('id', colunaId)
    .is('deleted_at', null)
    .maybeSingle()

  if (colErr) throw createError({ statusCode: 500, statusMessage: colErr.message })
  if (!coluna) return null

  const funilId =
    typeof coluna.funil_id === 'number'
      ? coluna.funil_id
      : Number.parseInt(String(coluna.funil_id ?? '').trim(), 10)
  if (!Number.isFinite(funilId) || funilId < 1) return null

  const { data: funil, error: funilErr } = await admin
    .from('funil_workspace')
    .select('workspace_id')
    .eq('id', funilId)
    .maybeSingle()

  if (funilErr) throw createError({ statusCode: 500, statusMessage: funilErr.message })
  if (!funil) return null

  const wsFunil =
    typeof funil.workspace_id === 'number'
      ? funil.workspace_id
      : Number.parseInt(String(funil.workspace_id ?? '').trim(), 10)
  if (!Number.isFinite(wsFunil) || wsFunil !== workspaceId) return null

  return String(funilId)
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

function parseTimezoneEscolhido(raw: unknown): string {
  if (raw === undefined || raw === null || raw === '') {
    throw createError({ statusCode: 400, statusMessage: 'timezone_escolhido é obrigatório.' })
  }
  const tz = String(raw).trim()
  if (!isTimezoneCampanhaPermitido(tz)) {
    throw createError({ statusCode: 400, statusMessage: 'timezone_escolhido inválido.' })
  }
  return tz
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

async function campanhaPertenceAoWorkspace(
  admin: SupabaseAdmin,
  campanhaId: string,
  workspaceId: number,
): Promise<{ url_midia: string | null; total_contatos: number | null; status: string | null; funil_id: string | null }> {
  const { data: campanha, error } = await admin
    .from('campanhas')
    .select('id, canal_id, url_midia, total_contatos, status, funil_id')
    .eq('id', campanhaId)
    .maybeSingle()

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  if (!campanha) {
    throw createError({ statusCode: 404, statusMessage: 'Campanha não encontrada.' })
  }

  const canalId =
    typeof campanha.canal_id === 'number'
      ? campanha.canal_id
      : Number.parseInt(String(campanha.canal_id ?? '').trim(), 10)
  if (!Number.isFinite(canalId) || canalId < 1) {
    throw createError({ statusCode: 400, statusMessage: 'Campanha sem canal associado.' })
  }

  const { data: canal, error: canalErr } = await admin
    .from('canais')
    .select('workspace_id')
    .eq('id', canalId)
    .is('deleted_at', null)
    .maybeSingle()

  if (canalErr) throw createError({ statusCode: 500, statusMessage: canalErr.message })
  if (!canal) {
    throw createError({ statusCode: 404, statusMessage: 'Canal da campanha não encontrado.' })
  }

  const wsCanal =
    typeof canal.workspace_id === 'number'
      ? canal.workspace_id
      : Number.parseInt(String(canal.workspace_id ?? '').trim(), 10)
  if (!Number.isFinite(wsCanal) || wsCanal !== workspaceId) {
    throw createError({ statusCode: 403, statusMessage: 'Campanha não pertence a este workspace.' })
  }

  return {
    url_midia: campanha.url_midia != null ? String(campanha.url_midia) : null,
    total_contatos:
      campanha.total_contatos != null && Number.isFinite(Number(campanha.total_contatos))
        ? Number(campanha.total_contatos)
        : null,
    status: campanha.status != null ? String(campanha.status) : null,
    funil_id: campanha.funil_id != null ? String(campanha.funil_id) : null,
  }
}

/**
 * PATCH /api/kanban/disparo_em_massa
 *
 * Atualiza registro em `campanhas` (sem reenfileirar disparos).
 */
export default defineEventHandler(async (event): Promise<AtualizarCampanhaResponse> => {
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

  const body = (await readBody<Body>(event).catch(() => null)) ?? {}
  const workspaceId = parseWorkspaceId(body.workspace_id)
  const campanhaId = parseCampanhaId(body.campanha_id)
  await checkWorkspace(event, workspaceId, userId)

  const admin = serverSupabaseServiceRole<any>(event)

  // Modo parcial: atualiza apenas `proximo_disparo` ou `data_inicio`.
  if (body.somente_agendamento === true || body.somente_agendamento === 'true' || body.somente_agendamento === 1) {
    const campoRaw = String(body.campo_agendamento ?? '').trim()
    if (campoRaw !== 'proximo_disparo' && campoRaw !== 'data_inicio') {
      throw createError({
        statusCode: 400,
        statusMessage: 'campo_agendamento deve ser proximo_disparo ou data_inicio.',
      })
    }

    const existente = await campanhaPertenceAoWorkspace(admin, campanhaId, workspaceId)
    if (existente.status === 'concluido') {
      throw createError({ statusCode: 400, statusMessage: 'Campanha concluída não pode ser editada.' })
    }

    const data_local = trimOrNull(body.data_local)
    const hora_local = trimOrNull(body.hora_local)
    const iso = parseDataInicio(data_local, hora_local)

    const updateAgendamento: Record<string, unknown> =
      campoRaw === 'proximo_disparo' ? { proximo_disparo: iso } : { data_inicio: iso }

    const { data: campanhaUpdate, error: campanhaErr } = await admin
      .from('campanhas')
      .update(updateAgendamento)
      .eq('id', campanhaId)
      .select(CAMPANHA_SELECT)
      .single()

    if (campanhaErr || !campanhaUpdate) {
      throw createError({
        statusCode: 500,
        statusMessage: campanhaErr?.message ?? 'Não foi possível atualizar o agendamento.',
      })
    }

    return {
      campanha: campanhaUpdate as CampanhaListItem,
    }
  }

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
  const coluna_ids = parseColunaIdsOpcional(body.coluna_ids)
  const coluna_id = parseColunaIdAposDisparo(body.coluna_id)
  let funil_id = parseFunilIdOpcional(body.funil_id)
  const coluna_erro_id = parseColunaErroId(body.coluna_erro_id)
  let funil_erro_id = parseFunilIdOpcional(body.funil_erro_id)
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
  const tamanho_lote = parseIntervaloMinutos(body.tamanho_lote, 'tamanho_lote')
  const pausa_lote_minutos = parseIntervaloMinutos(body.pausa_lote_minutos, 'pausa_lote_minutos')

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

  const existente = await campanhaPertenceAoWorkspace(admin, campanhaId, workspaceId)

  if (existente.status === 'concluido') {
    throw createError({ statusCode: 400, statusMessage: 'Campanha concluída não pode ser editada.' })
  }

  let total_contatos = existente.total_contatos ?? 0
  if (coluna_ids && coluna_ids.length > 0) {
    if (!funil_id) {
      funil_id = await resolverFunilIdDaColuna(admin, workspaceId, coluna_ids[0]!)
    }
    const conversaKeys = await buscarConversasKeys(
      admin,
      workspaceId,
      coluna_ids,
      fonte_canais_ids,
      envia_para_grupo,
    )
    total_contatos = conversaKeys.length
  } else if (!funil_id && coluna_id != null) {
    funil_id = await resolverFunilIdDaColuna(admin, workspaceId, coluna_id)
  } else if (!funil_id) {
    funil_id = existente.funil_id
  }

  if (!funil_erro_id) {
    funil_erro_id = await resolverFunilIdDaColuna(admin, workspaceId, coluna_erro_id)
  }
  if (!funil_erro_id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Não foi possível resolver o funil da coluna de erro.',
    })
  }

  let url_midia: string | null = tipo_mensagem === 'texto' ? null : existente.url_midia

  if (tipo_mensagem === 'imagem' || tipo_mensagem === 'audio') {
    const data_base64 = typeof body.data_base64 === 'string' ? body.data_base64.trim() : ''
    if (data_base64) {
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
    } else if (!url_midia) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Informe uma mídia para campanha com imagem ou áudio.',
      })
    }
  }

  const data_local = trimOrNull(body.data_local)
  const hora_local = trimOrNull(body.hora_local)
  const timezone_escolhido = parseTimezoneEscolhido(body.timezone_escolhido)
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

  const updateCampanha: Record<string, unknown> = {
    nome,
    tipo_mensagem,
    conteudo_texto,
    url_midia,
    intervalo_minimo_minutos,
    intervalo_maximo_minutos,
    tamanho_lote,
    pausa_lote_minutos,
    status,
    canal_id,
    canais_ids,
    data_inicio,
    total_contatos,
    ia_ligada,
    visualizacao_unica,
    hora_permitida_inicio,
    hora_permitida_fim,
    fonte_canal_id,
    envia_para_grupo,
    coluna_id,
    funil_id,
    coluna_erro_id,
    funil_erro_id,
    timezone_escolhido,
  }

  const { data: campanhaUpdate, error: campanhaErr } = await admin
    .from('campanhas')
    .update(updateCampanha)
    .eq('id', campanhaId)
    .select(CAMPANHA_SELECT)
    .single()

  if (campanhaErr || !campanhaUpdate) {
    throw createError({
      statusCode: 500,
      statusMessage: campanhaErr?.message ?? 'Não foi possível atualizar a campanha.',
    })
  }

  return {
    campanha: campanhaUpdate as CampanhaListItem,
  }
})
