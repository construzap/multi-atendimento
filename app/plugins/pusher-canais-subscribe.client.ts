import { watch } from 'vue'
import Pusher from 'pusher-js'
import type { PusherNovaMensagemPayload } from '#shared/types/mensagem'
import { useCanaisStore } from '~/stores/canais'
import { useConversasStore } from '~/stores/conversas'
import { useMensagensStore } from '~/stores/mensagens'

/** Inscreve em `String(id_canal)` conforme `canais.items`; `nova-mensagem` atualiza conversas + mensagens. */
export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const appKey = typeof config.public.pusherKey === 'string' ? config.public.pusherKey.trim() : ''
  const cluster =
    typeof config.public.pusherCluster === 'string' ? config.public.pusherCluster.trim() : ''
  if (!appKey || !cluster) return

  let client: Pusher | null = null
  const subscribedIds = new Set<number>()

  function getClient(): Pusher {
    if (!client) {
      client = new Pusher(appKey, { cluster })
    }
    return client
  }

  const canais = useCanaisStore()

  watch(
    () =>
      [...canais.items]
        .map((c) => c.id)
        .sort((a, b) => a - b)
        .join(','),
    () => {
      const p = getClient()
      const want = new Set(canais.items.map((c) => c.id))

      for (const id of subscribedIds) {
        if (!want.has(id)) {
          p.unsubscribe(String(id))
          subscribedIds.delete(id)
        }
      }

      for (const id of want) {
        if (subscribedIds.has(id)) continue
        const channel = p.subscribe(String(id))
        channel.bind('nova-mensagem', (data: PusherNovaMensagemPayload) => {
          useConversasStore().mergeFromPusherNovaMensagem(id, data)
          useMensagensStore().mergeFromPusherNovaMensagem(id, data)
        })
        subscribedIds.add(id)
      }
    },
    { immediate: true },
  )
})
