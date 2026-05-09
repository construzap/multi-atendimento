import type { Mensagem } from '#shared/types/mensagem'
import type { MensagemNormalizada } from '#shared/types/webhook'

/**
 * Mesmo formato do GET /api/mensagens / evento Pusher (inclui `name`/`photo` do contato).
 * `created_at` deriva de `message_timestamp` do webhook até o insert no Supabase.
 */
export function mensagemFromNormalizada(n: MensagemNormalizada, conversa_key: string): Mensagem {
  const createdAt =
    Number.isFinite(n.message_timestamp) && n.message_timestamp > 0
      ? new Date(n.message_timestamp).toISOString()
      : new Date().toISOString()

  return {
    key_conversa: conversa_key,
    message_id: n.message_id,
    created_at: createdAt,
    from_me: n.from_me,
    message: n.message,
    phone: n.phone,
    lid: n.lid,
    connected_phone: n.connected_phone,
    messagetype: n.messagetype,
    from_api: n.from_api,
    id_canal: n.id_canal,
    media_url: n.media_url,
    caption: n.caption,
    filename: n.filename,
    name: n.name,
    photo: n.photo,
  }
}
