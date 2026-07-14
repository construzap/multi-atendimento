import { watch } from 'vue'
import { syncConversasStoresFromRoute } from '~/composables/useConversasRouteSync'

/**
 * Mantém `conversas.conversaAtual`, `canais.currentCanalId` e `mensagens.activeKey`
 * alinhados com a URL do chat (`/workspaces/:id/chat/:canalId/:conversaKey?`).
 */
export default defineNuxtPlugin(() => {
  const route = useRoute()

  watch(
    () =>
      [
        route.path,
        route.params.canalId,
        route.params.conversaKey,
      ] as const,
    () => {
      syncConversasStoresFromRoute(route)
    },
    { immediate: true },
  )
})
