import { randomUUID } from 'node:crypto'
import type { MensagemNormalizada } from '#shared/types/webhook'
import { normalizeWhatsappBr } from '#shared/utils/normalizeWhatsappBr'
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
  | { ok: true; conversa_key: string; message_persisted?: boolean; conversa_name?: string | null }
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
}

type MensagemExistenteRow = {
  replyid: string | null
  key_conversa: string | null
  from_me: boolean | null
  from_api: boolean | null
  id_canal: number | null
  name: string | null
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
    .select('replyid, key_conversa, from_me, from_api, id_canal, name')
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
): Record<string, unknown> {
  const row: Record<string, unknown> = {
    message: normalizada.message,
    messatype: normalizada.messagetype,
    updated_at: updatedAt,
    ...patchNaoLidas(normalizada, existing),
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
    .update(buildConversaUpdateRow(normalizada, existing, updatedAt))
    .eq('key', conversa_key)

  if (convErr) return { ok: false, message: convErr.message }
  return { ok: true }
}

/** Conversa nova: insert completo em `conversas`. */
function buildConversaInsertRow(
  normalizada: MensagemNormalizada,
  conversa_key: string,
  updatedAt: string,
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
      const sync = await updateConversaPreviewExistente(admin, keyExistente, normalizada, updatedAt)
      if (!sync.ok) {
        return { ok: false, step: 'conversa', message: sync.message }
      }
      return { ok: true, conversa_key: keyExistente, message_persisted: false }
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
      .insert(buildConversaInsertRow(normalizada, conversa_key, updatedAt))

    if (convErr) {
      return { ok: false, step: 'conversa', message: convErr.message }
    }

    await ensureFunilLeadNoWebhook(admin, conversa_key, normalizada.workspace_id, updatedAt)
  }

  // Grava mensagem antes de atualizar preview (evita conversa com última msg sem linha em `mensagens`).
  // onConflict composto: mesmo message_id pode existir em canais diferentes (mesmo WhatsApp ID visto dos dois lados).
  const { error: msgErr } = await admin.from('mensagens').upsert(mensagemRow, { onConflict: 'message_id,id_canal' })

  if (msgErr) {
    return { ok: false, step: 'mensagem', message: msgErr.message }
  }

  if (existing) {
    const { error: convErr } = await admin
      .from('conversas')
      .update(buildConversaUpdateRow(normalizada, existing, updatedAt))
      .eq('key', conversa_key)

    if (convErr) {
      return { ok: false, step: 'conversa', message: convErr.message }
    }
  }

  const conversa_name = await loadConversaNameFromDb(admin, conversa_key)
  return {
    ok: true,
    conversa_key,
    message_persisted: true,
    conversa_name,
  }
}

async function persistGrupo(
  admin: SupabaseAdmin,
  normalizada: MensagemNormalizada,
  updatedAt: string,
  _options: PersistWebhookMensagemOptions,
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
      const sync = await updateConversaPreviewExistente(admin, keyExistente, normalizada, updatedAt)
      if (!sync.ok) {
        return { ok: false, step: 'conversa', message: sync.message }
      }
      return { ok: true, conversa_key: keyExistente, message_persisted: false }
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
    })

    if (convErr) {
      return { ok: false, step: 'conversa', message: convErr.message }
    }

    await ensureFunilLeadNoWebhook(admin, conversa_key, normalizada.workspace_id, updatedAt)
  }

  const { error: msgErr } = await admin.from('mensagens').upsert(mensagemRow, { onConflict: 'message_id,id_canal' })

  if (msgErr) {
    return { ok: false, step: 'mensagem', message: msgErr.message }
  }

  if (existing) {
    const updateRow: Record<string, unknown> = {
      message: normalizada.message,
      messatype: normalizada.messagetype,
      updated_at: updatedAt,
      ...patchNaoLidas(normalizada, existing),
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

  const conversa_name = await loadConversaNameFromDb(admin, conversa_key)
  return {
    ok: true,
    conversa_key,
    message_persisted: true,
    conversa_name,
  }
}
