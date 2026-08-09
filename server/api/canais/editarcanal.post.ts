import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import type { Canal } from '#shared/types/canal'
import {
  parseCanalHorariosOpcional,
  parseEndereco,
  parseLatitudeOpcional,
  parseLongitudeOpcional,
  parseTempoAvisoMinutos,
} from '#shared/utils/validarCanalConfigLoja'
import { createError, readBody } from 'h3'
import { checkChannel } from '../../utils/checkChannel'
import { getAuthUserId } from '../../utils/getAuthUserId'
import { setCanalApiKeyEncrypted } from '../../utils/encryptCanalApiKey'

type EditarCanalBody = {
  nome?: string
  descricao?: string | null
  workspace_id?: number | string
  id_canal?: number | string
  latitude?: number | string | null
  longitude?: number | string | null
  tempo_aviso_minutos?: number | string
  horarios?: unknown
  endereco?: string | null
  tem_inteligencia_artificial?: boolean
  url?: string | null
  model_name?: string | null
  /** Texto plano — criptografado no servidor com pgp_sym_encrypt. */
  api_key?: string | null
}

const CANAL_SELECT =
  'id, nome, descricao, provedor, created_at, endereco, latitude, longitude, tempo_aviso_minutos, horarios, tem_inteligencia_artificial, url, model_name, api_key_encrypted'

type CanalRow = Record<string, unknown> & { api_key_encrypted?: unknown }

function mapCanalPublico(row: CanalRow): Canal {
  const { api_key_encrypted, ...rest } = row
  const temApiKey =
    api_key_encrypted != null && String(api_key_encrypted).trim().length > 0

  return {
    ...(rest as Omit<Canal, 'tem_api_key' | 'tem_inteligencia_artificial'>),
    tem_inteligencia_artificial: Boolean(row.tem_inteligencia_artificial),
    url: typeof row.url === 'string' ? row.url : null,
    model_name: typeof row.model_name === 'string' ? row.model_name : null,
    tem_api_key: temApiKey,
  }
}

function hasOwn(body: EditarCanalBody, key: keyof EditarCanalBody): boolean {
  return Object.prototype.hasOwnProperty.call(body, key)
}

function trimOrNull(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw !== 'string') return null
  const t = raw.trim()
  return t || null
}

/**
 * POST /api/canais/editarcanal
 * Atualização parcial: envie só os campos que deseja alterar.
 *
 * - Loja: nome, descricao, endereco, lat/lng, tempo, horarios
 * - IA: tem_inteligencia_artificial, url, model_name, api_key (criptografada)
 */
export default defineEventHandler(async (event) => {
  const client = await serverSupabaseClient(event)
  const { data: authData, error: authError } = await client.auth.getUser()

  if (authError || !authData.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Não autenticado',
    })
  }

  const userId = getAuthUserId(authData.user)
  if (!userId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Não autenticado',
    })
  }

  const body = (await readBody<EditarCanalBody>(event)) ?? {}

  const rawWs = body.workspace_id
  if (rawWs === undefined || rawWs === null || rawWs === '') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Informe o workspace_id.',
    })
  }

  const workspaceId =
    typeof rawWs === 'number' ? rawWs : Number.parseInt(String(rawWs), 10)

  if (!Number.isFinite(workspaceId) || !Number.isInteger(workspaceId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'workspace_id inválido.',
    })
  }

  const rawCanal = body.id_canal
  if (rawCanal === undefined || rawCanal === null || rawCanal === '') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Informe o id_canal.',
    })
  }

  const canalId =
    typeof rawCanal === 'number' ? rawCanal : Number.parseInt(String(rawCanal), 10)

  if (!Number.isFinite(canalId) || !Number.isInteger(canalId) || canalId < 1) {
    throw createError({
      statusCode: 400,
      statusMessage: 'id_canal inválido.',
    })
  }

  const owns = await checkChannel(event, canalId, userId)
  if (!owns) {
    throw createError({
      statusCode: 403,
      statusMessage:
        'Canal não encontrado ou você não tem permissão para editá-lo.',
    })
  }

  const patch: Record<string, unknown> = {}

  if (hasOwn(body, 'nome')) {
    const nome = typeof body.nome === 'string' ? body.nome.trim() : ''
    if (!nome) {
      throw createError({ statusCode: 400, statusMessage: 'Informe o nome.' })
    }
    patch.nome = nome
  }

  if (hasOwn(body, 'descricao')) {
    const descricao = body.descricao === undefined ? null : body.descricao
    if (descricao !== null && typeof descricao !== 'string') {
      throw createError({ statusCode: 400, statusMessage: 'Descrição inválida.' })
    }
    patch.descricao = typeof descricao === 'string' ? descricao.trim() || null : null
  }

  if (hasOwn(body, 'endereco')) {
    patch.endereco = parseEndereco(body.endereco)
  }

  if (hasOwn(body, 'latitude')) {
    const latitudeParsed = parseLatitudeOpcional(body.latitude)
    if (typeof latitudeParsed === 'string') {
      throw createError({ statusCode: 400, statusMessage: latitudeParsed })
    }
    patch.latitude = latitudeParsed
  }

  if (hasOwn(body, 'longitude')) {
    const longitudeParsed = parseLongitudeOpcional(body.longitude)
    if (typeof longitudeParsed === 'string') {
      throw createError({ statusCode: 400, statusMessage: longitudeParsed })
    }
    patch.longitude = longitudeParsed
  }

  if (hasOwn(body, 'tempo_aviso_minutos')) {
    const tempoAvisoParsed = parseTempoAvisoMinutos(body.tempo_aviso_minutos)
    if (typeof tempoAvisoParsed === 'string') {
      throw createError({ statusCode: 400, statusMessage: tempoAvisoParsed })
    }
    patch.tempo_aviso_minutos = tempoAvisoParsed
  }

  if (hasOwn(body, 'horarios')) {
    const horariosParsed = parseCanalHorariosOpcional(body.horarios)
    if (typeof horariosParsed === 'string') {
      throw createError({ statusCode: 400, statusMessage: horariosParsed })
    }
    if (horariosParsed) patch.horarios = horariosParsed
  }

  if (hasOwn(body, 'tem_inteligencia_artificial')) {
    if (typeof body.tem_inteligencia_artificial !== 'boolean') {
      throw createError({
        statusCode: 400,
        statusMessage: 'tem_inteligencia_artificial inválido.',
      })
    }
    patch.tem_inteligencia_artificial = body.tem_inteligencia_artificial
  }

  if (hasOwn(body, 'url')) {
    patch.url = trimOrNull(body.url)
  }

  if (hasOwn(body, 'model_name')) {
    patch.model_name = trimOrNull(body.model_name)
  }

  const apiKeyPlain =
    hasOwn(body, 'api_key') && typeof body.api_key === 'string'
      ? body.api_key.trim()
      : ''

  if (Object.keys(patch).length === 0 && !apiKeyPlain) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Nenhum campo para atualizar.',
    })
  }

  const admin = serverSupabaseServiceRole<any>(event)

  if (apiKeyPlain) {
    const config = useRuntimeConfig(event)
    const passphrase = String(
      config.agenteSenhaMestraEncriptografiaApiKey ?? '',
    ).trim()
    if (!passphrase) {
      throw createError({
        statusCode: 500,
        statusMessage:
          'NUXT_AGENTE_SENHA_MESTRA_ENCRIPITOGRAFIA_API_KEY não configurada no servidor.',
      })
    }
    await setCanalApiKeyEncrypted(admin, {
      canalId,
      workspaceId,
      apiKeyPlain,
      passphrase,
    })
  }

  if (Object.keys(patch).length > 0) {
    const { error: upErr } = await admin
      .from('canais')
      .update(patch)
      .eq('id', canalId)
      .eq('user_id', userId)
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .is('deleted_by', null)

    if (upErr) {
      throw createError({
        statusCode: 500,
        statusMessage: upErr.message,
      })
    }
  }

  const { data, error } = await admin
    .from('canais')
    .select(CANAL_SELECT)
    .eq('id', canalId)
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .is('deleted_by', null)
    .maybeSingle()

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message,
    })
  }

  if (!data) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Canal não encontrado neste workspace ou foi removido.',
    })
  }

  return mapCanalPublico(data as CanalRow)
})
