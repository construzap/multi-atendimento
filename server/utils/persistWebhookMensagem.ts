import { randomUUID } from 'node:crypto'
import type { MensagemNormalizada } from '#shared/types/webhook'

/** Cliente retornado por `serverSupabaseServiceRole` do módulo `@nuxtjs/supabase` (service role). */
type SupabaseAdmin = ReturnType<
  typeof import('#supabase/server').serverSupabaseServiceRole<any>
>

type ConversaRow = {
  key: string
  name: string | null
  photo: string | null
  phone: string | null
  lid: string | null
}

async function findConversaPorCanalELidOuPhone(
  admin: SupabaseAdmin,
  id_canal: number,
  lid: string | null,
  phone: string | null,
): Promise<ConversaRow | null> {
  if (lid) {
    const { data, error } = await admin
      .from('conversas')
      .select('key, name, photo, phone, lid')
      .eq('id_canal', id_canal)
      .eq('lid', lid)
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (data) return data as ConversaRow
  }

  if (phone) {
    const { data, error } = await admin
      .from('conversas')
      .select('key, name, photo, phone, lid')
      .eq('id_canal', id_canal)
      .eq('phone', phone)
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (data) return data as ConversaRow
  }

  return null
}

function coalesceStr(a: string | null | undefined, b: string | null | undefined): string | null {
  const x = typeof a === 'string' && a.trim() ? a.trim() : ''
  if (x) return x
  const y = typeof b === 'string' && b.trim() ? b.trim() : ''
  return y || null
}

/**
 * Persiste conversa (lookup por id_canal + lid OU phone; key UUID se nova) e mensagem (`key_conversa`).
 *
 * **conversas:** `name` só é atualizado quando `from_me === false`.
 */
export async function persistWebhookMensagem(
  admin: SupabaseAdmin,
  normalizada: MensagemNormalizada,
): Promise<
  | { ok: true; conversa_key: string }
  | { ok: false; step: 'conversa' | 'mensagem'; message: string }
> {
  let existing: ConversaRow | null = null
  try {
    existing = await findConversaPorCanalELidOuPhone(
      admin,
      normalizada.id_canal,
      normalizada.lid,
      normalizada.phone,
    )
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, step: 'conversa', message: msg }
  }

  const conversa_key = existing?.key ?? randomUUID()

  const existingName = existing?.name ?? null
  const existingPhoto = existing?.photo ?? null

  const nameToPersist = !normalizada.from_me
    ? coalesceStr(normalizada.name, existingName)
    : existingName

  const photoToPersist = !normalizada.from_me
    ? coalesceStr(normalizada.photo, existingPhoto)
    : existingPhoto

  const phoneToPersist = coalesceStr(normalizada.phone, existing?.phone ?? null)
  const lidToPersist = coalesceStr(normalizada.lid, existing?.lid ?? null)

  const updatedAt =
    Number.isFinite(normalizada.message_timestamp) && normalizada.message_timestamp > 0
      ? new Date(normalizada.message_timestamp).toISOString()
      : new Date().toISOString()

  const conversaRow = {
    key: conversa_key,
    message: normalizada.message,
    messatype: normalizada.messagetype,
    name: nameToPersist,
    updated_at: updatedAt,
    id_canal: normalizada.id_canal,
    workspace_id: normalizada.workspace_id,
    phone: phoneToPersist,
    lid: lidToPersist,
    connect_phone: normalizada.connected_phone,
    photo: photoToPersist,
    from_me: normalizada.from_me,
    media_url: normalizada.media_url,
  }

  const { error: convErr } = await admin.from('conversas').upsert(conversaRow, { onConflict: 'key' })

  if (convErr) {
    return { ok: false, step: 'conversa', message: convErr.message }
  }

  const mensagemRow = {
    message_id: normalizada.message_id,
    from_me: normalizada.from_me,
    message: normalizada.message,
    phone: normalizada.phone,
    lid: normalizada.lid,
    connected_phone: normalizada.connected_phone,
    messagetype: normalizada.messagetype,
    from_api: normalizada.from_api,
    id_canal: normalizada.id_canal,
    media_url: normalizada.media_url,
    caption: normalizada.caption,
    filename: normalizada.filename,
    key_conversa: conversa_key,
  }

  const { error: msgErr } = await admin.from('mensagens').upsert(mensagemRow, { onConflict: 'message_id' })

  if (msgErr) {
    return { ok: false, step: 'mensagem', message: msgErr.message }
  }

  return { ok: true, conversa_key }
}
