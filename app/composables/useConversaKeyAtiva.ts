import { parseConversaKeyParam } from '~/utils/chatRouteParams'

/**
 * Key da conversa ativa no chat: lê `route.params.conversaKey` (URL = fonte da verdade).
 * Pinia é sincronizado pelo plugin `conversas-route-sync.client.ts`.
 */
export function useConversaKeyAtiva() {
  const route = useRoute()

  const conversaKeyFromRoute = computed(() => {
    const key = parseConversaKeyParam(route.params.conversaKey)
    return key || null
  })

  const conversaKeyAtiva = conversaKeyFromRoute

  return {
    conversaKeyFromRoute,
    conversaKeyAtiva,
  }
}
