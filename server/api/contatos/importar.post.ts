import { randomUUID } from 'node:crypto'
import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
import { assertMethod, createError, readBody } from 'h3'
import type {
  ContatoImportarLinha,
  ContatosImportarLoteResponse,
} from '#shared/types/contato'
import type { TipoCampoPersonalizado } from '#shared/types/camposPersonalizados'
import { normalizeTelefoneBrParaEnvio, telefoneContatoNormalizadoValido } from '#shared/utils/normalizeWhatsappBr'
import { serializarValorCampo, tipoCampoFromRow } from '../../utils/camposPersonalizadosDb'
import { checkChannel } from '../../utils/checkChannel'
import { checkWorkspace } from '../../utils/checkWorkspace'
import { getAuthUserId } from '../../utils/getAuthUserId'

const MAX_LINHAS_POR_REQUISICAO = 50

type Body = {
  workspace_id?: unknown
  linhas?: unknown
}

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

function strOrNull(v: unknown): string | null {
  if (v === undefined || v === null) return null
  const s = typeof v === 'string' ? v.trim() : String(v).trim()
  return s.length ? s : null
}

function intOrNull(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null
  const n = typeof v === 'number' ? Math.trunc(v) : Number.parseInt(String(v).trim(), 10)
  return Number.isFinite(n) ? n : null
}

function numOrNull(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null
  const n = typeof v === 'number' ? v : Number.parseFloat(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function boolOrNull(v: unknown): boolean | null {
  if (v === undefined || v === null || v === '') return null
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v !== 0
  const s = String(v).trim().toLowerCase()
  if (['0', 'n', 'nao', 'não', 'false', 'f', 'off', 'fechada', 'fechado'].includes(s)) return false
  if (['1', 's', 'sim', 'true', 't', 'on', 'aberta', 'aberto'].includes(s)) return true
  return null
}

function normalizePhoneInput(input: unknown, linhaLabel = ''): string {
  const normalized = normalizeTelefoneBrParaEnvio(input)
  if (!normalized) {
    throw createError({
      statusCode: 400,
      statusMessage: `${linhaLabel}Telefone não pode ser vazio.`,
    })
  }

  if (!telefoneContatoNormalizadoValido(normalized)) {
    const detalhe = normalized.startsWith('55')
      ? 'Use DDI+DDD+número (ex: 55 11 9xxxx xxxx).'
      : 'Informe um número válido.'
    throw createError({
      statusCode: 400,
      statusMessage: `${linhaLabel}Telefone incompleto (${normalized}). ${detalhe}`,
    })
  }

  return normalized
}

function parseDataIsoInput(raw: unknown, linhaLabel: string): string | null {
  if (raw === undefined || raw === null || raw === '') return null
  const s = String(raw).trim()
  if (!s) return null
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) {
    throw createError({
      statusCode: 400,
      statusMessage: `${linhaLabel}created_at inválido.`,
    })
  }
  return d.toISOString()
}

function normalizarLinha(raw: unknown, idx: number): ContatoImportarLinha {
  if (!raw || typeof raw !== 'object') {
    throw createError({
      statusCode: 400,
      statusMessage: `Linha ${idx + 1}: formato inválido.`,
    })
  }

  const o = raw as Record<string, unknown>
  const idCanal = intOrNull(o.id_canal)
  if (idCanal == null || idCanal < 1) {
    throw createError({
      statusCode: 400,
      statusMessage: `Linha ${idx + 1}: id_canal é obrigatório.`,
    })
  }

  const phone = normalizePhoneInput(o.phone, `Linha ${idx + 1}: `)

  const name = strOrNull(o.name)
  if (!name) {
    throw createError({
      statusCode: 400,
      statusMessage: `Linha ${idx + 1}: nome é obrigatório.`,
    })
  }

  const linha: ContatoImportarLinha = {
    phone,
    id_canal: idCanal,
    name,
    lid: strOrNull(o.lid),
    photo: strOrNull(o.photo),
    created_at: parseDataIsoInput(o.created_at, `Linha ${idx + 1}: `),
    conversa_aberta: boolOrNull(o.conversa_aberta),
    name_group: strOrNull(o.name_group),
    ia_ligada: boolOrNull(o.ia_ligada),
    latitude: numOrNull(o.latitude),
    longitude: numOrNull(o.longitude),
  }

  const cps = o.campos_personalizados
  if (cps !== undefined) {
    if (!Array.isArray(cps)) {
      throw createError({
        statusCode: 400,
        statusMessage: `Linha ${idx + 1}: campos_personalizados deve ser um array.`,
      })
    }
    linha.campos_personalizados = cps.map((item, cpIdx) => {
      if (!item || typeof item !== 'object') {
        throw createError({
          statusCode: 400,
          statusMessage: `Linha ${idx + 1}, campo personalizado ${cpIdx + 1}: formato inválido.`,
        })
      }
      const rec = item as Record<string, unknown>
      const campoId = intOrNull(rec.campo_id)
      if (campoId == null) {
        throw createError({
          statusCode: 400,
          statusMessage: `Linha ${idx + 1}, campo personalizado ${cpIdx + 1}: campo_id inválido.`,
        })
      }
      return { campo_id: campoId, valor: rec.valor }
    })
  }

  const sf = o.status_funil
  if (sf !== undefined) {
    if (!sf || typeof sf !== 'object' || Array.isArray(sf)) {
      throw createError({
        statusCode: 400,
        statusMessage: `Linha ${idx + 1}: status_funil inválido.`,
      })
    }
    const rec = sf as Record<string, unknown>
    const colunaId = intOrNull(rec.coluna_id)
    if (colunaId == null || colunaId < 1) {
      throw createError({
        statusCode: 400,
        statusMessage: `Linha ${idx + 1}: coluna_id do funil é obrigatório quando status_funil é enviado.`,
      })
    }
    const atendenteId = strOrNull(rec.atendente_id)
    linha.status_funil = {
      coluna_id: colunaId,
      atendente_id: atendenteId,
    }
  }

  return linha
}

function mesclarCamposPersonalizadosImportacao(
  a: ContatoImportarLinha['campos_personalizados'],
  b: ContatoImportarLinha['campos_personalizados'],
): ContatoImportarLinha['campos_personalizados'] {
  const map = new Map<number, NonNullable<ContatoImportarLinha['campos_personalizados']>[number]>()
  for (const cp of a ?? []) map.set(cp.campo_id, cp)
  for (const cp of b ?? []) map.set(cp.campo_id, cp)
  return map.size ? [...map.values()] : undefined
}

function mesclarLinhasImportacao(prev: ContatoImportarLinha, next: ContatoImportarLinha): ContatoImportarLinha {
  const merged: ContatoImportarLinha = { ...prev, ...next }
  const cps = mesclarCamposPersonalizadosImportacao(prev.campos_personalizados, next.campos_personalizados)
  if (cps?.length) merged.campos_personalizados = cps
  else delete merged.campos_personalizados
  if (next.status_funil) merged.status_funil = next.status_funil
  else if (prev.status_funil) merged.status_funil = prev.status_funil
  return merged
}

/** Evita duplicatas no mesmo lote (mesmo telefone → mesma conversa). */
function deduplicarLinhasPorPhone(linhas: ContatoImportarLinha[]): ContatoImportarLinha[] {
  const porPhone = new Map<string, ContatoImportarLinha>()
  for (const linha of linhas) {
    const prev = porPhone.get(linha.phone)
    porPhone.set(linha.phone, prev ? mesclarLinhasImportacao(prev, linha) : linha)
  }
  return [...porPhone.values()]
}

type ValorCpRow = {
  campo_id: number
  conversa_key: string
  valor: string | null
  updated_at: string
}

function deduplicarValoresCp(rows: ValorCpRow[]): ValorCpRow[] {
  const map = new Map<string, ValorCpRow>()
  for (const row of rows) {
    map.set(`${row.conversa_key}\x1f${row.campo_id}`, row)
  }
  return [...map.values()]
}

async function mapaTiposCamposPersonalizados(
  admin: ReturnType<typeof serverSupabaseServiceRole<any>>,
  workspaceId: number,
): Promise<Map<number, TipoCampoPersonalizado>> {
  const { data, error } = await admin
    .from('campos_personalizados')
    .select('id, tipo')
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const map = new Map<number, TipoCampoPersonalizado>()
  for (const row of data ?? []) {
    const rec = row as { id?: unknown; tipo?: unknown }
    const id = typeof rec.id === 'number' ? rec.id : Number(rec.id)
    if (!Number.isFinite(id)) continue
    map.set(id, tipoCampoFromRow(rec.tipo))
  }
  return map
}

async function validarCanaisDoLote(
  event: Parameters<typeof checkChannel>[0],
  admin: ReturnType<typeof serverSupabaseServiceRole<any>>,
  workspaceId: number,
  canalIds: number[],
  userId: string,
) {
  const uniq = [...new Set(canalIds.filter((x) => x > 0))]
  if (!uniq.length) {
    throw createError({ statusCode: 400, statusMessage: 'Nenhum canal válido no lote.' })
  }

  const { data, error } = await admin
    .from('canais')
    .select('id')
    .eq('workspace_id', workspaceId)
    .in('id', uniq)
    .is('deleted_at', null)
    .is('deleted_by', null)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const okIds = new Set(
    (data ?? [])
      .map((r: { id?: unknown }) => (typeof r.id === 'number' ? r.id : Number(r.id)))
      .filter((n: number) => Number.isFinite(n)),
  )

  for (const id of uniq) {
    if (!okIds.has(id)) {
      throw createError({
        statusCode: 400,
        statusMessage: `Canal #${id} inválido ou não pertence a este workspace.`,
      })
    }
    const allowed = await checkChannel(event, id, userId)
    if (!allowed) {
      throw createError({
        statusCode: 403,
        statusMessage: `Sem permissão para o canal #${id}.`,
      })
    }
  }
}

async function validarColunasFunilDoLote(
  admin: ReturnType<typeof serverSupabaseServiceRole<any>>,
  workspaceId: number,
  colunaIds: number[],
): Promise<number | null> {
  const uniq = [...new Set(colunaIds.filter((x) => x > 0))]
  if (!uniq.length) return null

  const { data: funil, error: funilErr } = await admin
    .from('funil_workspace')
    .select('id')
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (funilErr) {
    throw createError({ statusCode: 500, statusMessage: funilErr.message })
  }
  if (!funil?.id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Funil não encontrado para este workspace.',
    })
  }

  const funilId = typeof funil.id === 'number' ? funil.id : Number(funil.id)

  const { data, error } = await admin
    .from('funil_workspace_colunas')
    .select('id')
    .eq('funil_id', funilId)
    .in('id', uniq)
    .is('deleted_at', null)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const okIds = new Set(
    (data ?? [])
      .map((r: { id?: unknown }) => (typeof r.id === 'number' ? r.id : Number(r.id)))
      .filter((n: number) => Number.isFinite(n)),
  )

  for (const id of uniq) {
    if (!okIds.has(id)) {
      throw createError({
        statusCode: 400,
        statusMessage: `Coluna do funil #${id} inválida ou não pertence a este workspace.`,
      })
    }
  }

  return funilId
}

/** Resolve identificador (uuid user / email) → `atendentes.id` (bigint em `conversas.atendente_id`). */
async function resolverAtendentesDoLote(
  admin: ReturnType<typeof serverSupabaseServiceRole<any>>,
  workspaceId: number,
  atendenteIds: string[],
): Promise<Map<string, number>> {
  const uniq = [...new Set(atendenteIds.map((x) => x.trim()).filter(Boolean))]
  const resolvido = new Map<string, number>()
  if (!uniq.length) return resolvido

  const { data, error } = await admin
    .from('view_atendentes')
    .select('id, atendente_user_id, email')
    .eq('workspace_id', workspaceId)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const porIdentificador = new Map<string, number>()
  for (const row of data ?? []) {
    const idRaw = (row as { id?: unknown }).id
    const atendenteId = typeof idRaw === 'number' ? idRaw : Number(idRaw)
    if (!Number.isFinite(atendenteId) || atendenteId < 1) continue

    const uidRaw = (row as { atendente_user_id?: unknown }).atendente_user_id
    const userId =
      typeof uidRaw === 'string' ? uidRaw.trim() : uidRaw != null ? String(uidRaw).trim() : ''
    if (userId) porIdentificador.set(userId.toLowerCase(), atendenteId)

    const emailRaw = (row as { email?: unknown }).email
    const email =
      typeof emailRaw === 'string' ? emailRaw.trim().toLowerCase() : emailRaw != null ? String(emailRaw).trim().toLowerCase() : ''
    if (email) porIdentificador.set(email, atendenteId)

    porIdentificador.set(String(atendenteId), atendenteId)
  }

  for (const id of uniq) {
    const canonical = porIdentificador.get(id.toLowerCase())
    if (canonical == null) {
      throw createError({
        statusCode: 400,
        statusMessage: `Atendente "${id}" não encontrado neste workspace.`,
      })
    }
    resolvido.set(id, canonical)
  }

  return resolvido
}

type ConversaExistentePorPhone = {
  key: string
  id_canal: number | null
}

async function mapaConversasExistentesPorPhone(
  admin: ReturnType<typeof serverSupabaseServiceRole<any>>,
  workspaceId: number,
  phones: string[],
): Promise<Map<string, ConversaExistentePorPhone>> {
  const uniq = [...new Set(phones.map((p) => p.trim()).filter(Boolean))]
  const map = new Map<string, ConversaExistentePorPhone>()
  if (!uniq.length) return map

  const { data, error } = await admin
    .from('conversas')
    .select('key, phone, id_canal, updated_at')
    .eq('workspace_id', workspaceId)
    .in('phone', uniq)
    .is('deleted_at', null)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const rows = [...(data ?? [])] as Array<{
    key?: unknown
    phone?: unknown
    id_canal?: unknown
    updated_at?: unknown
  }>

  rows.sort((a, b) => {
    const ta = typeof a.updated_at === 'string' ? Date.parse(a.updated_at) : 0
    const tb = typeof b.updated_at === 'string' ? Date.parse(b.updated_at) : 0
    return tb - ta
  })

  for (const row of rows) {
    const phone = typeof row.phone === 'string' ? row.phone.trim() : ''
    const key = typeof row.key === 'string' ? row.key.trim() : ''
    if (!phone || !key || map.has(phone)) continue

    const idCanalRaw = row.id_canal
    const id_canal =
      idCanalRaw != null && Number.isFinite(Number(idCanalRaw)) && Number(idCanalRaw) >= 1
        ? Math.trunc(Number(idCanalRaw))
        : null

    map.set(phone, { key, id_canal })
  }

  return map
}

/**
 * POST /api/contatos/importar
 *
 * Body: `{ workspace_id, linhas }` — até {@link MAX_LINHAS_POR_REQUISICAO} linhas por pedido.
 * Para cada linha: upsert em `conversas` reutilizando conversa existente pelo `phone` no workspace
 * (evita duplicatas entre canais) e, se houver, upsert em `valores_campos_personalizados`
 * e/ou `coluna_id` / `funil_id` / `atendente_id` em `conversas`.
 */
export default defineEventHandler(async (event): Promise<ContatosImportarLoteResponse> => {
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
  const linhasRaw = body.linhas

  if (!Array.isArray(linhasRaw)) {
    throw createError({ statusCode: 400, statusMessage: 'linhas deve ser um array.' })
  }
  if (linhasRaw.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Envie pelo menos uma linha.' })
  }
  if (linhasRaw.length > MAX_LINHAS_POR_REQUISICAO) {
    throw createError({
      statusCode: 400,
      statusMessage: `No máximo ${MAX_LINHAS_POR_REQUISICAO} linhas por requisição.`,
    })
  }

  await checkWorkspace(event, workspaceId, userId)

  const linhas = deduplicarLinhasPorPhone(linhasRaw.map((item, idx) => normalizarLinha(item, idx)))

  const admin = serverSupabaseServiceRole<any>(event)
  await validarCanaisDoLote(
    event,
    admin,
    workspaceId,
    linhas.map((l) => l.id_canal),
    userId,
  )

  const funilId = await validarColunasFunilDoLote(
    admin,
    workspaceId,
    linhas.map((l) => l.status_funil?.coluna_id).filter((id): id is number => id != null && id > 0),
  )

  const atendentesResolvidos = await resolverAtendentesDoLote(
    admin,
    workspaceId,
    linhas
      .map((l) => l.status_funil?.atendente_id)
      .filter((id): id is string => typeof id === 'string' && id.trim().length > 0),
  )

  const tiposCampos = await mapaTiposCamposPersonalizados(admin, workspaceId)
  const conversasPorPhone = await mapaConversasExistentesPorPhone(
    admin,
    workspaceId,
    linhas.map((l) => l.phone),
  )
  const nowIso = new Date().toISOString()

  let inseridos = 0
  let atualizados = 0
  let statusFunilGravados = 0
  const valoresCpRows: ValorCpRow[] = []

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i]!

    const existente = conversasPorPhone.get(linha.phone) ?? null

    const conversaKey = existente?.key ?? randomUUID()

    const row: Record<string, unknown> = {
      key: conversaKey,
      workspace_id: workspaceId,
      id_canal: linha.id_canal,
      phone: linha.phone,
      is_group: false,
      updated_at: nowIso,
    }

    if (linha.name !== undefined) row.name = linha.name
    if (linha.lid !== undefined) row.lid = linha.lid
    if (linha.photo !== undefined) row.photo = linha.photo
    if (linha.conversa_aberta !== undefined && linha.conversa_aberta !== null) {
      row.conversa_aberta = linha.conversa_aberta
    }
    if (linha.name_group !== undefined) row.name_group = linha.name_group
    if (linha.ia_ligada !== undefined && linha.ia_ligada !== null) {
      row.ia_ligada = linha.ia_ligada
    }
    if (linha.latitude !== undefined) row.latitude = linha.latitude
    if (linha.longitude !== undefined) row.longitude = linha.longitude

    if (linha.status_funil?.coluna_id) {
      row.coluna_id = linha.status_funil.coluna_id
      if (funilId != null) row.funil_id = funilId
      const atendenteBruto = linha.status_funil.atendente_id?.trim() ?? ''
      if (atendenteBruto) {
        row.atendente_id = atendentesResolvidos.get(atendenteBruto) ?? null
      }
      statusFunilGravados += 1
    }

    if (!existente) {
      row.created_at = linha.created_at ?? nowIso
      row.conversa_aberta = linha.conversa_aberta ?? true
      row.nao_lidas = 0
      if (linha.ia_ligada === undefined || linha.ia_ligada === null) {
        row.ia_ligada = false
      }
    } else if (linha.created_at) {
      row.created_at = linha.created_at
    }

    const { error: upsErr } = await admin.from('conversas').upsert(row, { onConflict: 'key' })
    if (upsErr) {
      throw createError({
        statusCode: 500,
        statusMessage: `Linha ${i + 1}: ${upsErr.message}`,
      })
    }

    if (existente) atualizados += 1
    else {
      inseridos += 1
      conversasPorPhone.set(linha.phone, { key: conversaKey, id_canal: linha.id_canal })
    }

    for (const cp of linha.campos_personalizados ?? []) {
      const tipo = tiposCampos.get(cp.campo_id)
      if (!tipo) {
        throw createError({
          statusCode: 400,
          statusMessage: `Linha ${i + 1}: campo personalizado #${cp.campo_id} não encontrado.`,
        })
      }
      const valor = serializarValorCampo(tipo, cp.valor)
      valoresCpRows.push({
        campo_id: cp.campo_id,
        conversa_key: conversaKey,
        valor,
        updated_at: nowIso,
      })
    }
  }

  let camposPersonalizadosGravados = 0
  const valoresCpUnicos = deduplicarValoresCp(valoresCpRows)
  if (valoresCpUnicos.length > 0) {
    const { error: cpErr } = await admin
      .from('valores_campos_personalizados')
      .upsert(valoresCpUnicos, { onConflict: 'conversa_key,campo_id' })

    if (cpErr) {
      throw createError({ statusCode: 500, statusMessage: cpErr.message })
    }
    camposPersonalizadosGravados = valoresCpUnicos.length
  }

  return {
    inseridos,
    atualizados,
    campos_personalizados_gravados: camposPersonalizadosGravados,
    status_funil_gravados: statusFunilGravados,
  }
})
