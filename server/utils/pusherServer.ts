import Pusher from 'pusher'
import type { H3Event } from 'h3'
import type { PusherNovaMensagemPayload } from '#shared/types/mensagem'

let pusherClient: Pusher | null = null
let pusherConfigKey = ''

function pusherKeyFromConfig(config: ReturnType<typeof useRuntimeConfig>): string {
  return [
    config.public.pusherAppId,
    config.public.pusherKey,
    config.pusherSecret,
    config.public.pusherCluster,
  ].join('\0')
}

function getPusher(event: H3Event): Pusher | null {
  const config = useRuntimeConfig(event)
  const appId = config.public.pusherAppId
  const key = config.public.pusherKey
  const secret = config.pusherSecret
  const cluster = config.public.pusherCluster

  if (!appId || !key || !secret || !cluster) {
    return null
  }

  const cfgKey = pusherKeyFromConfig(config)
  if (!pusherClient || cfgKey !== pusherConfigKey) {
    pusherClient = new Pusher({
      appId: String(appId),
      key: String(key),
      secret: String(secret),
      cluster: String(cluster),
      useTLS: true,
    })
    pusherConfigKey = cfgKey
  }

  return pusherClient
}

/**
 * Canal = apenas `id_canal` (ex.: `"12"`): todas as conversas desse canal recebem o evento.
 * Evento: `nova-mensagem`.
 */
export async function triggerNovaMensagem(
  event: H3Event,
  idCanal: number,
  payload: PusherNovaMensagemPayload,
): Promise<void> {
  if (!Number.isFinite(idCanal)) {
    console.warn('[pusher] triggerNovaMensagem: id_canal inválido.')
    return
  }

  const channel = String(Math.trunc(idCanal))

  try {
    const pusher = getPusher(event)
    if (!pusher) {
      console.warn('[pusher] Broadcast ignorado: NUXT_PUBLIC_PUSHER_* / NUXT_PUSHER_SECRET ausentes.')
      return
    }

    await pusher.trigger(channel, 'nova-mensagem', payload)
  } catch (err) {
    console.warn('[pusher] Falha ao disparar nova-mensagem:', err)
  }
}
