import { watch } from 'vue'
import Pusher from 'pusher-js'
import type { PusherNovaMensagemPayload } from '#shared/types/mensagem'
import { useCanaisStore } from '~/stores/canais'
import { useConversasStore } from '~/stores/conversas'
import { useKanbanStore } from '~/stores/kanban'
import { useMensagensStore } from '~/stores/mensagens'

/** Inscreve em `String(id_canal)` conforme `canais.items` + canais dos cards do kanban. */
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
  const kanban = useKanbanStore()

  function canalIdsParaInscrever(): number[] {
    const ids = new Set<number>()
    for (const c of canais.items) {
      if (c.id >= 1) ids.add(c.id)
    }
    for (const col of kanban.columns) {
      for (const card of col.cards) {
        if (card.id_canal != null && card.id_canal >= 1) ids.add(card.id_canal)
      }
    }
    const infoCanal = kanban.infoContatoIdCanal
    if (infoCanal != null && infoCanal >= 1) ids.add(infoCanal)
    return [...ids].sort((a, b) => a - b)
  }

  watch(
    () => canalIdsParaInscrever().join(','),
    () => {
      const p = getClient()
      const want = new Set(canalIdsParaInscrever())

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
          useKanbanStore().mergeFromPusherNovaMensagem(id, data)
        })
        subscribedIds.add(id)
      }
    },
    { immediate: true },
  )
})
