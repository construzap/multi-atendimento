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
) {
  const uniq = [...new Set(colunaIds.filter((x) => x > 0))]
  if (!uniq.length) return

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
}

async function resolverAtendentesDoLote(
  admin: ReturnType<typeof serverSupabaseServiceRole<any>>,
  workspaceId: number,
  atendenteIds: string[],
): Promise<Map<string, string>> {
  const uniq = [...new Set(atendenteIds.map((x) => x.trim()).filter(Boolean))]
  const resolvido = new Map<string, string>()
  if (!uniq.length) return resolvido

  const { data, error } = await admin
    .from('view_atendentes')
    .select('atendente_user_id, email')
    .eq('workspace_id', workspaceId)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const porIdentificador = new Map<string, string>()
  for (const row of data ?? []) {
    const uidRaw = (row as { atendente_user_id?: unknown }).atendente_user_id
    const userId =
      typeof uidRaw === 'string' ? uidRaw.trim() : uidRaw != null ? String(uidRaw).trim() : ''
    if (!userId) continue

    porIdentificador.set(userId.toLowerCase(), userId)

    const emailRaw = (row as { email?: unknown }).email
    const email =
      typeof emailRaw === 'string' ? emailRaw.trim().toLowerCase() : emailRaw != null ? String(emailRaw).trim().toLowerCase() : ''
    if (email) porIdentificador.set(email, userId)
  }

  for (const id of uniq) {
    const canonical = porIdentificador.get(id.toLowerCase())
    if (!canonical) {
      throw createError({
        statusCode: 400,
        statusMessage: `Atendente "${id}" não encontrado neste workspace.`,
      })
    }
    resolvido.set(id, canonical)
  }

  return resolvido
}

/**
 * POST /api/contatos/importar
 *
 * Body: `{ workspace_id, linhas }` — até {@link MAX_LINHAS_POR_REQUISICAO} linhas por pedido.
 * Para cada linha: upsert em `conversas` (por `id_canal` + `phone`) e, se houver,
 * upsert em `valores_campos_personalizados` e/ou `funil_conversa_status` com o `conversa_key` resolvido.
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

  const linhas = linhasRaw.map((item, idx) => normalizarLinha(item, idx))

  const admin = serverSupabaseServiceRole<any>(event)
  await validarCanaisDoLote(
    event,
    admin,
    workspaceId,
    linhas.map((l) => l.id_canal),
    userId,
  )

  await validarColunasFunilDoLote(
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
  const nowIso = new Date().toISOString()

  let inseridos = 0
  let atualizados = 0
  const valoresCpRows: Array<{
    campo_id: number
    conversa_key: string
    valor: string | null
    updated_at: string
  }> = []
  const statusFunilRows: Array<{
    conversa_key: string
    workspace_id: number
    coluna_id: number
    atendente_id: string | null
    updated_at: string
  }> = []

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i]!

    const { data: existente, error: selErr } = await admin
      .from('conversas')
      .select('key')
      .eq('id_canal', linha.id_canal)
      .eq('phone', linha.phone)
      .is('deleted_at', null)
      .maybeSingle()

    if (selErr) {
      throw createError({ statusCode: 500, statusMessage: selErr.message })
    }

    const conversaKey =
      existente && typeof existente === 'object' && 'key' in existente
        ? String((existente as { key: unknown }).key)
        : randomUUID()

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
    else inseridos += 1

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

    if (linha.status_funil?.coluna_id) {
      const atendenteBruto = linha.status_funil.atendente_id?.trim() ?? ''
      statusFunilRows.push({
        conversa_key: conversaKey,
        workspace_id: workspaceId,
        coluna_id: linha.status_funil.coluna_id,
        atendente_id: atendenteBruto ? (atendentesResolvidos.get(atendenteBruto) ?? null) : null,
        updated_at: nowIso,
      })
    }
  }

  let camposPersonalizadosGravados = 0
  if (valoresCpRows.length > 0) {
    const { error: cpErr } = await admin
      .from('valores_campos_personalizados')
      .upsert(valoresCpRows, { onConflict: 'conversa_key,campo_id' })

    if (cpErr) {
      throw createError({ statusCode: 500, statusMessage: cpErr.message })
    }
    camposPersonalizadosGravados = valoresCpRows.length
  }

  let statusFunilGravados = 0
  if (statusFunilRows.length > 0) {
    const { error: funilErr } = await admin
      .from('funil_conversa_status')
      .upsert(statusFunilRows, { onConflict: 'conversa_key' })

    if (funilErr) {
      throw createError({ statusCode: 500, statusMessage: funilErr.message })
    }
    statusFunilGravados = statusFunilRows.length
  }

  return {
    inseridos,
    atualizados,
    campos_personalizados_gravados: camposPersonalizadosGravados,
    status_funil_gravados: statusFunilGravados,
  }
})
