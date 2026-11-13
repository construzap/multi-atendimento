import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import type { CanalConfigFollowUp } from '#shared/types/canal'
import type { MensagemNormalizada } from '#shared/types/webhook'
import { normalizeWhatsappBr } from '#shared/utils/normalizeWhatsappBr'
import { aplicarFollowupNoWebhook } from '../api/followup/aplicarFollowupNoWebhook'
import {
  extrairLabelId,
  mensagemAtivaFollowUpPorPalavras,
  normalizarConfigFollowUp,
  textoMensagemParaAtivacaoFollowUp,
} from '#shared/utils/validarCanalCamposExtras'
import {
  ajustarDataProximoDisparoParaJanela,
  FOLLOW_UP_TIMEZONE,
} from '../api/followup/followupJanela'
import { ensureFunilLeadNoWebhook } from './ensureFunilLeadNoWebhook'

/** Cliente retornado por `serverSupabaseServiceRole` do módulo `@nuxtjs/supabase` (service role). */
type SupabaseAdmin = ReturnType<
  typeof import('#supabase/server').serverSupabaseServiceRole<any>
>

const VIEW_KANBAN_CONVERSAS = 'view_kanban_conversas'

const VIEW_LOOKUP_SELECT =
  'conversa_key, name, phone, photo, lid, id_canal, nao_lidas' as const

type ConversaRow = {
  key: string
  id_canal: number | null
  name: string | null
  photo: string | null
  phone: string | null
  lid: string | null
  nao_lidas: number
}

type ViewConversaLookupRow = {
  conversa_key: string
  name: string | null
  phone: string | null
  photo: string | null
  lid: string | null
  id_canal: number | null
  nao_lidas: number | null
}

/** Conversa só é reutilizada quando `id_canal` está preenchido e coincide com o canal do evento. */
function conversaPertenceAoCanal(row: ConversaRow | null, id_canal: number): boolean {
  if (!row) return false
  if (row.id_canal == null || !Number.isFinite(Number(row.id_canal))) return false
  return Number(row.id_canal) === Number(id_canal)
}

function viewRowToConversaRow(row: ViewConversaLookupRow): ConversaRow {
  return {
    key: row.conversa_key,
    id_canal: row.id_canal,
    name: row.name,
    photo: row.photo,
    phone: row.phone,
    lid: row.lid,
    nao_lidas: row.nao_lidas ?? 0,
  }
}

export type PersistWebhookMensagemResult =
  | {
      ok: true
      conversa_key: string
      message_persisted?: boolean
      conversa_name?: string | null
      /** Vendedor humano agendou `data_proximo_disparo` nesta mensagem. */
      follow_up_agendado?: boolean
      /** `config_follow_up["1"].etiqueta` quando `follow_up_agendado`. */
      follow_up_etiqueta_etapa_1?: string | null
    }
  | { ok: false; step: 'conversa' | 'mensagem'; message: string }

function digitsIguais(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  return normalizeWhatsappBr(a) === normalizeWhatsappBr(b)
}

/** Não usar `owner` / `connect_phone` do canal como telefone do contato. */
function phoneContatoParaBusca(
  phone: string | null | undefined,
  connectedPhone: string | null | undefined,
): string | null {
  const p = typeof phone === 'string' && phone.trim() ? phone.trim() : null
  if (!p) return null
  if (digitsIguais(p, connectedPhone)) return null
  return p
}

function phoneContatoParaGravar(
  phone: string | null | undefined,
  connectedPhone: string | null | undefined,
): string | null {
  return phoneContatoParaBusca(phone, connectedPhone)
}

function escolherMelhorConversa(
  rows: ConversaRow[],
  lid: string | null,
  phone: string | null,
  connectedPhone: string | null,
): ConversaRow | null {
  const candidatas = rows.filter((r) => {
    if (!phoneContatoParaBusca(r.phone, connectedPhone) && r.phone) {
      if (lid && r.lid?.trim() === lid.trim()) return true
      return false
    }
    return true
  })
  if (!candidatas.length) return null
  if (lid && phone) {
    const ambos = candidatas.find((r) => r.lid?.trim() === lid.trim() && r.phone?.trim() === phone.trim())
    if (ambos) return ambos
  }
  if (lid) {
    const byLid = candidatas.find((r) => r.lid?.trim() === lid.trim())
    if (byLid) return byLid
  }
  if (phone) {
    const byPhone = candidatas.find((r) => r.phone?.trim() === phone.trim())
    if (byPhone) return byPhone
  }
  const comLid = candidatas.find((r) => r.lid != null && String(r.lid).trim())
  return comLid ?? candidatas[0] ?? null
}

export type PersistWebhookMensagemOptions = {
  /** `conversas.key` da sessão aberta no app (POST /api/mensagens). */
  conversa_key_hint?: string | null
  /**
   * `canais.botao_para_iniciar_ia`.
   * Se `true` na criação da conversa → `ia_ligada: false` (usuário inicia a I.A. pelo botão).
   * Se `false`/omitido → mantém o default `ia_ligada: true`.
   */
  botao_para_iniciar_ia?: boolean | null
  /**
   * `canais.config_follow_up` (só webhook).
   * Sem isso, não agenda follow-up (ex.: POST /api/mensagens).
   */
  config_follow_up?: unknown
  /**
   * `canais.palavras_ativacao_follow_up` (só webhook).
   * Se houver palavras, o vendedor humano só agenda follow-up se a mensagem contiver alguma.
   */
  palavras_ativacao_follow_up?: unknown
}

function minutosEsperaEtapa1(config: CanalConfigFollowUp): number | null {
  const passo = config['1']
  if (!passo) return null
  const n = passo.minutos_espera
  if (!Number.isFinite(n) || n < 1) return null
  return Math.trunc(n)
}

type FollowUpConversaResolver = {
  campos: Record<string, unknown>
  /** Vendedor humano agendou follow-up (etapa 1) nesta mensagem. */
  agendado: boolean
  /** `labelid` de `config_follow_up["1"].etiqueta` quando agendou. */
  etiqueta_etapa_1: string | null
}

/**
 * Resolve patch de follow-up em `conversas` + meta para etiquetas WhatsApp:
 * - from_me + from_ia → não mexe
 * - from_me humano + etapa 1 → data_proximo_disparo + contagem_follow_up = 1
 *   (se houver palavras_ativacao_follow_up, só se a mensagem contiver alguma)
 * - from_me false → data_proximo_disparo = null
 */
function resolverFollowUpConversa(
  normalizada: MensagemNormalizada,
  options: PersistWebhookMensagemOptions,
): FollowUpConversaResolver {
  if (normalizada.from_me && normalizada.from_ia) {
    return { campos: {}, agendado: false, etiqueta_etapa_1: null }
  }

  if (!normalizada.from_me) {
    return {
      campos: { data_proximo_disparo: null },
      agendado: false,
      etiqueta_etapa_1: null,
    }
  }

  // from_me humano: só agenda se o webhook passou config_follow_up com etapa 1.
  if (options.config_follow_up === undefined) {
    return { campos: {}, agendado: false, etiqueta_etapa_1: null }
  }

  const texto = textoMensagemParaAtivacaoFollowUp({
    message: normalizada.message,
    caption: normalizada.caption,
  })
  if (!mensagemAtivaFollowUpPorPalavras(texto, options.palavras_ativacao_follow_up)) {
    return { campos: {}, agendado: false, etiqueta_etapa_1: null }
  }

  const config = normalizarConfigFollowUp(options.config_follow_up)
  const minutos = minutosEsperaEtapa1(config)
  if (minutos == null) {
    return { campos: {}, agendado: false, etiqueta_etapa_1: null }
  }

  const candidate = DateTime.now().setZone(FOLLOW_UP_TIMEZONE).plus({ minutes: minutos })
  const ajustada = ajustarDataProximoDisparoParaJanela(candidate)
  const iso = ajustada.toUTC().toISO()
  if (!iso) {
    return { campos: {}, agendado: false, etiqueta_etapa_1: null }
  }

  return {
    campos: {
      data_proximo_disparo: iso,
      contagem_follow_up: 1,
    },
    agendado: true,
    etiqueta_etapa_1: extrairLabelId(config['1']?.etiqueta),
  }
}

function patchFollowUp(
  normalizada: MensagemNormalizada,
  options: PersistWebhookMensagemOptions,
): Record<string, unknown> {
  return resolverFollowUpConversa(normalizada, options).campos
}

function metaFollowUpNoResultado(
  normalizada: MensagemNormalizada,
  options: PersistWebhookMensagemOptions,
): Pick<
  Extract<PersistWebhookMensagemResult, { ok: true }>,
  'follow_up_agendado' | 'follow_up_etiqueta_etapa_1'
> {
  const r = resolverFollowUpConversa(normalizada, options)
  return {
    follow_up_agendado: r.agendado,
    follow_up_etiqueta_etapa_1: r.agendado ? r.etiqueta_etapa_1 : null,
  }
}

type MensagemExistenteRow = {
  id?: string | null
  replyid: string | null
  key_conversa: string | null
  from_me: boolean | null
  from_api: boolean | null
  id_canal: number | null
  name: string | null
}

async function loadMensagemUuid(
  admin: SupabaseAdmin,
  message_id: string,
  id_canal: number,
): Promise<string | null> {
  const { data, error } = await admin
    .from('mensagens')
    .select('id')
    .eq('message_id', message_id)
    .eq('id_canal', id_canal)
    .maybeSingle()

  if (error) {
    console.warn('[persistWebhookMensagem] lookup mensagens.id:', error.message)
    return null
  }
  const id = data && typeof data === 'object' ? (data as { id?: unknown }).id : null
  return typeof id === 'string' && id.trim() ? id.trim() : null
}

/** Ciclos/etapas após persistir; falha não quebra o webhook. */
async function tentarAplicarFollowupCiclos(
  admin: SupabaseAdmin,
  input: {
    conversa_key: string
    normalizada: MensagemNormalizada
    options: PersistWebhookMensagemOptions
    mensagem_uuid: string | null
  },
): Promise<void> {
  try {
    await aplicarFollowupNoWebhook(admin, {
      conversa_key: input.conversa_key,
      workspace_id: input.normalizada.workspace_id,
      canal_id: input.normalizada.id_canal,
      mensagem_uuid: input.mensagem_uuid,
      normalizada: input.normalizada,
      config_follow_up: input.options.config_follow_up,
      palavras_ativacao_follow_up: input.options.palavras_ativacao_follow_up,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn('[persistWebhookMensagem] followup ciclos/etapas:', msg)
  }
}

async function findConversaPorKey(
  admin: SupabaseAdmin,
  id_canal: number,
  key: string,
): Promise<ConversaRow | null> {
  const { data, error } = await admin
    .from(VIEW_KANBAN_CONVERSAS)
    .select(VIEW_LOOKUP_SELECT)
    .eq('id_canal', id_canal)
    .eq('conversa_key', key)
    .maybeSingle()

  if (error) throw new Error(error.message)
  const row = data ? viewRowToConversaRow(data as ViewConversaLookupRow) : null
  return conversaPertenceAoCanal(row, id_canal) ? row : null
}

/** Conversa aberta no app (`conversa_sessao`) — valida `id_canal` depois. */
async function findConversaPorKeySessao(
  admin: SupabaseAdmin,
  key: string,
): Promise<ConversaRow | null> {
  const k = key.trim()
  if (!k) return null

  const { data, error } = await admin
    .from(VIEW_KANBAN_CONVERSAS)
    .select(VIEW_LOOKUP_SELECT)
    .eq('conversa_key', k)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? viewRowToConversaRow(data as ViewConversaLookupRow) : null
}

/**
 * Busca conversa existente via `view_kanban_conversas`:
 * filtra por `id_canal` + (`lid` OU `phone` do payload).
 */
async function findConversaPorCanalELidOuPhone(
  admin: SupabaseAdmin,
  id_canal: number,
  lid: string | null,
  phone: string | null,
  connectedPhone: string | null = null,
): Promise<ConversaRow | null> {
  const lidNorm = typeof lid === 'string' && lid.trim() ? lid.trim() : null
  const phoneNorm = phoneContatoParaBusca(phone, connectedPhone)

  if (!lidNorm && !phoneNorm) return null

  if (lidNorm) {
    const { data, error } = await admin
      .from(VIEW_KANBAN_CONVERSAS)
      .select(VIEW_LOOKUP_SELECT)
      .eq('id_canal', id_canal)
      .eq('lid', lidNorm)
      .maybeSingle()

    if (error) throw new Error(error.message)
    const row = data ? viewRowToConversaRow(data as ViewConversaLookupRow) : null
    if (conversaPertenceAoCanal(row, id_canal)) return row
  }

  if (phoneNorm) {
    const { data, error } = await admin
      .from(VIEW_KANBAN_CONVERSAS)
      .select(VIEW_LOOKUP_SELECT)
      .eq('id_canal', id_canal)
      .eq('phone', phoneNorm)

    if (error) throw new Error(error.message)
    const rows = ((data ?? []) as ViewConversaLookupRow[]).map(viewRowToConversaRow).filter((r) =>
      conversaPertenceAoCanal(r, id_canal),
    )
    const escolhida = escolherMelhorConversa(rows, lidNorm, phoneNorm, connectedPhone)
    if (escolhida) return escolhida
  }

  if (lidNorm && phoneNorm) {
    const { data, error } = await admin
      .from(VIEW_KANBAN_CONVERSAS)
      .select(VIEW_LOOKUP_SELECT)
      .eq('id_canal', id_canal)
      .or(`lid.eq.${lidNorm},phone.eq.${phoneNorm}`)

    if (error) throw new Error(error.message)
    const rows = ((data ?? []) as ViewConversaLookupRow[]).map(viewRowToConversaRow).filter((r) =>
      conversaPertenceAoCanal(r, id_canal),
    )
    return escolherMelhorConversa(rows, lidNorm, phoneNorm, connectedPhone)
  }

  return null
}

async function findConversaGrupo(
  admin: SupabaseAdmin,
  id_canal: number,
  idGroup: string,
): Promise<ConversaRow | null> {
  const byPhoneLid = await findConversaPorCanalELidOuPhone(admin, id_canal, idGroup, idGroup)
  if (byPhoneLid) return byPhoneLid

  const { data, error } = await admin
    .from(VIEW_KANBAN_CONVERSAS)
    .select(VIEW_LOOKUP_SELECT)
    .eq('id_canal', id_canal)
    .eq('id_group', idGroup)
    .maybeSingle()

  if (error) throw new Error(error.message)
  const row = data ? viewRowToConversaRow(data as ViewConversaLookupRow) : null
  return conversaPertenceAoCanal(row, id_canal) ? row : null
}

function coalesceStr(a: string | null | undefined, b: string | null | undefined): string | null {
  const x = typeof a === 'string' && a.trim() ? a.trim() : ''
  if (x) return x
  const y = typeof b === 'string' && b.trim() ? b.trim() : ''
  return y || null
}

function nextNaoLidas(existing: ConversaRow | null): number {
  const atual = existing?.nao_lidas ?? 0
  return atual + 1
}

/**
 * Regras de `nao_lidas` na conversa:
 * - Mensagem recebida (`from_me: false`): incrementa e marca `conversa_aberta`.
 * - Mensagem enviada (`from_me: true`) com IA: mantém.
 * - Mensagem enviada sem IA: zera.
 */
function patchNaoLidas(
  normalizada: MensagemNormalizada,
  existing: ConversaRow | null,
): { conversa_aberta?: boolean; nao_lidas?: number } {
  if (!normalizada.from_me) {
    return { conversa_aberta: true, nao_lidas: nextNaoLidas(existing) }
  }
  if (normalizada.from_ia) {
    return {}
  }
  return { nao_lidas: 0 }
}

/** Busca `message_id` **somente** no canal do token (não em outros canais). */
async function loadMensagemNoCanal(
  admin: SupabaseAdmin,
  message_id: string,
  id_canal: number,
): Promise<MensagemExistenteRow | null> {
  const { data, error } = await admin
    .from('mensagens')
    .select('id, replyid, key_conversa, from_me, from_api, id_canal, name')
    .eq('message_id', message_id)
    .eq('id_canal', id_canal)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? (data as MensagemExistenteRow) : null
}

function buildMensagemRow(
  normalizada: MensagemNormalizada,
  conversa_key: string,
  replyid: string | null,
  createdAtIso: string,
  existingName: string | null = null,
) {
  const nameIncoming =
    !normalizada.from_me && typeof normalizada.name === 'string' && normalizada.name.trim()
      ? normalizada.name.trim()
      : null
  /** Só grava `name` na criação ou se o valor atual no banco estiver vazio. */
  const nameToPersist = campoIdentificadorVazio(existingName) ? nameIncoming : undefined

  return {
    message_id: normalizada.message_id,
    created_at: createdAtIso,
    from_me: normalizada.from_me,
    message: normalizada.message,
    phone: phoneContatoParaGravar(normalizada.phone, normalizada.connected_phone),
    lid: normalizada.lid,
    connected_phone: normalizada.connected_phone,
    messagetype: normalizada.messagetype,
    from_api: normalizada.from_api,
    id_canal: normalizada.id_canal,
    media_url: normalizada.media_url,
    caption: normalizada.caption,
    filename: normalizada.filename,
    key_conversa: conversa_key,
    ...(nameToPersist !== undefined ? { name: nameToPersist } : {}),
    ...(replyid ? { replyid } : {}),
  }
}

function campoIdentificadorVazio(v: string | null | undefined): boolean {
  return !(typeof v === 'string' && v.trim())
}

/** Lê `conversas.name` no banco após persist (fonte da verdade para o Pusher). */
async function loadConversaNameFromDb(
  admin: SupabaseAdmin,
  conversa_key: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from('conversas')
    .select('name')
    .eq('key', conversa_key)
    .maybeSingle()
  if (error || !data || typeof data !== 'object') return null
  const name = (data as { name?: string | null }).name
  return typeof name === 'string' && name.trim() ? name.trim() : null
}

/**
 * Conversa existente: preview + `nao_lidas`; foto se mensagem recebida.
 * Completa `name`/`phone`/`lid` só quando o campo está vazio no banco e o payload trouxe valor
 * (não sobrescreve valores já gravados).
 */
function buildConversaUpdateRow(
  normalizada: MensagemNormalizada,
  existing: ConversaRow,
  updatedAt: string,
  options: PersistWebhookMensagemOptions = {},
): Record<string, unknown> {
  const row: Record<string, unknown> = {
    message: normalizada.message,
    messatype: normalizada.messagetype,
    updated_at: updatedAt,
    from_me: normalizada.from_me,
    media_url: normalizada.media_url,
    ...patchNaoLidas(normalizada, existing),
    ...patchFollowUp(normalizada, options),
  }

  if (!normalizada.from_me) {
    const photo = coalesceStr(normalizada.photo, existing.photo)
    if (photo) row.photo = photo

    const nameIncoming = coalesceStr(normalizada.name, null)
    if (campoIdentificadorVazio(existing.name) && nameIncoming) {
      row.name = nameIncoming
    }
  }

  const phoneIncoming = phoneContatoParaGravar(normalizada.phone, normalizada.connected_phone)
  if (campoIdentificadorVazio(existing.phone) && phoneIncoming) {
    row.phone = phoneIncoming
  }

  const lidIncoming = normalizada.lid?.trim() || null
  if (campoIdentificadorVazio(existing.lid) && lidIncoming) {
    row.lid = lidIncoming
  }

  return row
}

/** Atualiza preview da conversa quando a mensagem já existe (eco do webhook / idempotência). */
async function updateConversaPreviewExistente(
  admin: SupabaseAdmin,
  conversa_key: string,
  normalizada: MensagemNormalizada,
  updatedAt: string,
  options: PersistWebhookMensagemOptions = {},
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data, error } = await admin
    .from('conversas')
    .select('key, name, photo, phone, lid, nao_lidas, id_canal')
    .eq('key', conversa_key)
    .maybeSingle()

  if (error) return { ok: false, message: error.message }
  if (!data || typeof data !== 'object') return { ok: true }

  const existing = data as ConversaRow
  const { error: convErr } = await admin
    .from('conversas')
    .update(buildConversaUpdateRow(normalizada, existing, updatedAt, options))
    .eq('key', conversa_key)

  if (convErr) return { ok: false, message: convErr.message }
  return { ok: true }
}

/** `botao_para_iniciar_ia === true` → conversa nasce com I.A. desligada. */
function iaLigadaAoCriarConversa(botaoParaIniciarIa: boolean | null | undefined): boolean {
  return botaoParaIniciarIa === true ? false : true
}

/** Conversa nova: insert completo em `conversas`. */
function buildConversaInsertRow(
  normalizada: MensagemNormalizada,
  conversa_key: string,
  updatedAt: string,
  options: PersistWebhookMensagemOptions = {},
): Record<string, unknown> {
  const nameToPersist = !normalizada.from_me ? coalesceStr(normalizada.name, null) : null
  const photoToPersist = !normalizada.from_me ? coalesceStr(normalizada.photo, null) : null

  return {
    key: conversa_key,
    message: normalizada.message,
    messatype: normalizada.messagetype,
    name: nameToPersist,
    created_at: updatedAt,
    updated_at: updatedAt,
    id_canal: normalizada.id_canal,
    workspace_id: normalizada.workspace_id,
    phone: phoneContatoParaGravar(normalizada.phone, normalizada.connected_phone),
    lid: normalizada.lid?.trim() || null,
    connect_phone: normalizada.connected_phone,
    photo: photoToPersist,
    from_me: normalizada.from_me,
    media_url: normalizada.media_url,
    conversa_aberta: normalizada.from_me ? null : true,
    nao_lidas: normalizada.from_me ? 0 : 1,
    is_group: false,
    ia_ligada: iaLigadaAoCriarConversa(options.botao_para_iniciar_ia),
    ...patchFollowUp(normalizada, options),
  }
}

/**
 * Persiste conversa e mensagem do webhook.
 *
 * Lookup via `view_kanban_conversas` (`id_canal` + `lid`/`phone`).
 * Conversa existente → UPDATE preview; conversa nova → INSERT.
 * Mensagem → upsert em `mensagens` (PK `message_id`).
 */
export async function persistWebhookMensagem(
  admin: SupabaseAdmin,
  normalizada: MensagemNormalizada,
  options: PersistWebhookMensagemOptions = {},
): Promise<PersistWebhookMensagemResult> {
  const updatedAt =
    Number.isFinite(normalizada.message_timestamp) && normalizada.message_timestamp > 0
      ? new Date(normalizada.message_timestamp).toISOString()
      : new Date().toISOString()

  if (normalizada.is_group && normalizada.id_group) {
    return persistGrupo(admin, normalizada, updatedAt, options)
  }

  return persistIndividual(admin, normalizada, updatedAt, options)
}

async function persistIndividual(
  admin: SupabaseAdmin,
  normalizada: MensagemNormalizada,
  updatedAt: string,
  options: PersistWebhookMensagemOptions,
): Promise<PersistWebhookMensagemResult> {
  // Idempotência só no canal do token: se já existe aqui, não grava de novo.
  let mensagemNoCanal: MensagemExistenteRow | null = null
  try {
    mensagemNoCanal = await loadMensagemNoCanal(
      admin,
      normalizada.message_id,
      normalizada.id_canal,
    )
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, step: 'mensagem', message: msg }
  }

  if (mensagemNoCanal) {
    const keyExistente = mensagemNoCanal.key_conversa?.trim() || ''
    if (keyExistente) {
      const sync = await updateConversaPreviewExistente(
        admin,
        keyExistente,
        normalizada,
        updatedAt,
        options,
      )
      if (!sync.ok) {
        return { ok: false, step: 'conversa', message: sync.message }
      }
      // Eco do webhook (mensagem já gravada pelo app): ainda aplica ciclos/etapas.
      const mensagemUuid =
        typeof mensagemNoCanal.id === 'string' && mensagemNoCanal.id.trim()
          ? mensagemNoCanal.id.trim()
          : await loadMensagemUuid(admin, normalizada.message_id, normalizada.id_canal)
      await tentarAplicarFollowupCiclos(admin, {
        conversa_key: keyExistente,
        normalizada,
        options,
        mensagem_uuid: mensagemUuid,
      })
      return {
        ok: true,
        conversa_key: keyExistente,
        message_persisted: false,
        ...metaFollowUpNoResultado(normalizada, options),
      }
    }
    // Mensagem órfã (sem key_conversa) — reparar abaixo.
  }

  // Não existe neste canal (ou está órfã) → grava.
  const hint = options.conversa_key_hint?.trim() || null
  let existing: ConversaRow | null = null
  let usarHintComoKey = false

  try {
    if (hint) {
      const bySessao = await findConversaPorKeySessao(admin, hint)
      if (bySessao && Number(bySessao.id_canal) === Number(normalizada.id_canal)) {
        existing = bySessao
        usarHintComoKey = true
      } else {
        const byKey = await findConversaPorKey(admin, normalizada.id_canal, hint)
        if (byKey) {
          existing = byKey
          usarHintComoKey = true
        }
      }
    }
    if (!existing) {
      existing = await findConversaPorCanalELidOuPhone(
        admin,
        normalizada.id_canal,
        normalizada.lid,
        normalizada.phone,
        normalizada.connected_phone,
      )
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, step: 'conversa', message: msg }
  }

  const conversa_key =
    usarHintComoKey && hint ? hint : existing?.key ?? randomUUID()

  const replyid = normalizada.replyid?.trim() || null
  const mensagemRow = buildMensagemRow(
    normalizada,
    conversa_key,
    replyid,
    updatedAt,
    mensagemNoCanal?.name ?? null,
  )

  if (!existing) {
    const { error: convErr } = await admin
      .from('conversas')
      .insert(buildConversaInsertRow(normalizada, conversa_key, updatedAt, options))

    if (convErr) {
      return { ok: false, step: 'conversa', message: convErr.message }
    }

    await ensureFunilLeadNoWebhook(admin, conversa_key, normalizada.workspace_id, updatedAt)
  }

  // Grava mensagem antes de atualizar preview (evita conversa com última msg sem linha em `mensagens`).
  // onConflict composto: mesmo message_id pode existir em canais diferentes (mesmo WhatsApp ID visto dos dois lados).
  const { data: msgUpsert, error: msgErr } = await admin
    .from('mensagens')
    .upsert(mensagemRow, { onConflict: 'message_id,id_canal' })
    .select('id')
    .maybeSingle()

  if (msgErr) {
    return { ok: false, step: 'mensagem', message: msgErr.message }
  }

  if (existing) {
    const { error: convErr } = await admin
      .from('conversas')
      .update(buildConversaUpdateRow(normalizada, existing, updatedAt, options))
      .eq('key', conversa_key)

    if (convErr) {
      return { ok: false, step: 'conversa', message: convErr.message }
    }
  }

  let mensagemUuid =
    msgUpsert && typeof msgUpsert === 'object' && typeof (msgUpsert as { id?: unknown }).id === 'string'
      ? String((msgUpsert as { id: string }).id)
      : null
  if (!mensagemUuid) {
    mensagemUuid = await loadMensagemUuid(admin, normalizada.message_id, normalizada.id_canal)
  }

  await tentarAplicarFollowupCiclos(admin, {
    conversa_key,
    normalizada,
    options,
    mensagem_uuid: mensagemUuid,
  })

  const conversa_name = await loadConversaNameFromDb(admin, conversa_key)
  return {
    ok: true,
    conversa_key,
    message_persisted: true,
    conversa_name,
    ...metaFollowUpNoResultado(normalizada, options),
  }
}

async function persistGrupo(
  admin: SupabaseAdmin,
  normalizada: MensagemNormalizada,
  updatedAt: string,
  options: PersistWebhookMensagemOptions,
): Promise<PersistWebhookMensagemResult> {
  let mensagemNoCanal: MensagemExistenteRow | null = null
  try {
    mensagemNoCanal = await loadMensagemNoCanal(
      admin,
      normalizada.message_id,
      normalizada.id_canal,
    )
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, step: 'mensagem', message: msg }
  }

  if (mensagemNoCanal) {
    const keyExistente = mensagemNoCanal.key_conversa?.trim() || ''
    if (keyExistente) {
      const sync = await updateConversaPreviewExistente(
        admin,
        keyExistente,
        normalizada,
        updatedAt,
        options,
      )
      if (!sync.ok) {
        return { ok: false, step: 'conversa', message: sync.message }
      }
      // Eco do webhook (mensagem já gravada pelo app): ainda aplica ciclos/etapas.
      const mensagemUuid =
        typeof mensagemNoCanal.id === 'string' && mensagemNoCanal.id.trim()
          ? mensagemNoCanal.id.trim()
          : await loadMensagemUuid(admin, normalizada.message_id, normalizada.id_canal)
      await tentarAplicarFollowupCiclos(admin, {
        conversa_key: keyExistente,
        normalizada,
        options,
        mensagem_uuid: mensagemUuid,
      })
      return {
        ok: true,
        conversa_key: keyExistente,
        message_persisted: false,
        ...metaFollowUpNoResultado(normalizada, options),
      }
    }
  }

  const idGroup = normalizada.id_group!
  let existing: ConversaRow | null = null
  try {
    existing = await findConversaGrupo(admin, normalizada.id_canal, idGroup)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, step: 'conversa', message: msg }
  }

  const conversa_key = existing?.key ?? randomUUID()

  const replyid = normalizada.replyid?.trim() || null
  const mensagemRow = buildMensagemRow(
    normalizada,
    conversa_key,
    replyid,
    updatedAt,
    mensagemNoCanal?.name ?? null,
  )

  if (!existing) {
    const { error: convErr } = await admin.from('conversas').insert({
      key: conversa_key,
      message: normalizada.message,
      messatype: normalizada.messagetype,
      name: coalesceStr(normalizada.name_group, null),
      created_at: updatedAt,
      updated_at: updatedAt,
      id_canal: normalizada.id_canal,
      workspace_id: normalizada.workspace_id,
      phone: idGroup,
      lid: idGroup,
      id_group: idGroup,
      name_group: normalizada.name_group,
      connect_phone: normalizada.connected_phone,
      photo: coalesceStr(normalizada.photo, null),
      from_me: normalizada.from_me,
      media_url: normalizada.media_url,
      is_group: true,
      conversa_aberta: normalizada.from_me ? null : true,
      nao_lidas: normalizada.from_me ? 0 : 1,
      ia_ligada: iaLigadaAoCriarConversa(options.botao_para_iniciar_ia),
      ...patchFollowUp(normalizada, options),
    })

    if (convErr) {
      return { ok: false, step: 'conversa', message: convErr.message }
    }

    await ensureFunilLeadNoWebhook(admin, conversa_key, normalizada.workspace_id, updatedAt)
  }

  const { data: msgUpsert, error: msgErr } = await admin
    .from('mensagens')
    .upsert(mensagemRow, { onConflict: 'message_id,id_canal' })
    .select('id')
    .maybeSingle()

  if (msgErr) {
    return { ok: false, step: 'mensagem', message: msgErr.message }
  }

  if (existing) {
    const updateRow: Record<string, unknown> = {
      message: normalizada.message,
      messatype: normalizada.messagetype,
      updated_at: updatedAt,
      from_me: normalizada.from_me,
      media_url: normalizada.media_url,
      ...patchNaoLidas(normalizada, existing),
      ...patchFollowUp(normalizada, options),
    }
    if (!normalizada.from_me) {
      const photo = coalesceStr(normalizada.photo, existing.photo)
      if (photo) updateRow.photo = photo
    }

    // Nome do grupo: só preenche se ainda estiver vazio no banco.
    const nameGroupIncoming = coalesceStr(normalizada.name_group, null)
    if (campoIdentificadorVazio(existing.name) && nameGroupIncoming) {
      updateRow.name = nameGroupIncoming
    }

    const { error: convErr } = await admin
      .from('conversas')
      .update(updateRow)
      .eq('key', conversa_key)

    if (convErr) {
      return { ok: false, step: 'conversa', message: convErr.message }
    }
  }

  let mensagemUuid =
    msgUpsert && typeof msgUpsert === 'object' && typeof (msgUpsert as { id?: unknown }).id === 'string'
      ? String((msgUpsert as { id: string }).id)
      : null
  if (!mensagemUuid) {
    mensagemUuid = await loadMensagemUuid(admin, normalizada.message_id, normalizada.id_canal)
  }

  await tentarAplicarFollowupCiclos(admin, {
    conversa_key,
    normalizada,
    options,
    mensagem_uuid: mensagemUuid,
  })

  const conversa_name = await loadConversaNameFromDb(admin, conversa_key)
  return {
    ok: true,
    conversa_key,
    message_persisted: true,
    conversa_name,
    ...metaFollowUpNoResultado(normalizada, options),
  }
}
