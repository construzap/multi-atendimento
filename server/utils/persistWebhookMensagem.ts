import type { MensagemNormalizada } from '#shared/types/webhook'

/** Cliente retornado por `serverSupabaseServiceRole` do módulo `@nuxtjs/supabase` (service role). */
type SupabaseAdmin = ReturnType<
  typeof import('#supabase/server').serverSupabaseServiceRole<any>
>

/**
 * Persiste conversa (upsert por `key`) e mensagem (upsert por `message_id`) a partir do payload normalizado.
 *
 * **conversas:** `name` só é atualizado quando `from_me === false` (mantém o nome já salvo se a msg for sua).
 * **mensagens:** grava/atualiza todos os campos normalizados (idempotente em `message_id`).
 */
export async function persistWebhookMensagem(
  admin: SupabaseAdmin,
  normalizada: MensagemNormalizada,
): Promise<{ ok: true } | { ok: false; step: 'conversa' | 'mensagem'; message: string }> {
  const { data: existing, error: selectErr } = await admin
    .from('conversas')
    .select('name')
    .eq('key', normalizada.conversa_key)
    .maybeSingle()

  if (selectErr) {
    return { ok: false, step: 'conversa', message: selectErr.message }
  }

  const existingName =
    existing && typeof existing === 'object' && 'name' in existing
      ? (existing as { name: string | null }).name
      : null

  const nameToPersist = !normalizada.from_me
    ? (normalizada.name ?? existingName ?? null)
    : (existingName ?? null)

  const updatedAt =
    Number.isFinite(normalizada.message_timestamp) && normalizada.message_timestamp > 0
      ? new Date(normalizada.message_timestamp).toISOString()
      : new Date().toISOString()

  const conversaRow = {
    key: normalizada.conversa_key,
    message: normalizada.message,
    messatype: normalizada.messagetype,
    name: nameToPersist,
    updated_at: updatedAt,
    id_canal: normalizada.id_canal,
    phone: normalizada.phone,
    lid: normalizada.lid,
    connect_phone: normalizada.connected_phone,
    photo: normalizada.photo,
    from_me: normalizada.from_me,
    media_url: normalizada.media_url,
  }

  const { error: convErr } = await admin
    .from('conversas')
    .upsert(conversaRow, { onConflict: 'key' })

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
  }

  const { error: msgErr } = await admin
    .from('mensagens')
    .upsert(mensagemRow, { onConflict: 'message_id' })

  if (msgErr) {
    return { ok: false, step: 'mensagem', message: msgErr.message }
  }

  return { ok: true }
}
