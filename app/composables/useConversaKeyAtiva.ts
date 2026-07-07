function parseConversaKeyParam(raw: unknown): string {
  const s = String(raw ?? '').trim()
  if (!s) return ''
  try {
    return decodeURIComponent(s).trim()
  } catch {
    return s
  }
}

/**
 * Key da conversa ativa no chat: prioriza `route.params.conversaKey` (URL),
 * com fallback em `conversas.conversaAtual` (Pinia).
 */
export function useConversaKeyAtiva() {
  const route = useRoute()
  const conversasStore = useConversasStore()
  const canaisStore = useCanaisStore()

  const conversaKeyFromRoute = computed(() => parseConversaKeyParam(route.params.conversaKey))

  const conversaKeyAtiva = computed(() => {
    const fromRoute = conversaKeyFromRoute.value
    if (fromRoute) return fromRoute
    const fromStore = conversasStore.conversaAtual?.trim()
    return fromStore || null
  })

  watch(
    conversaKeyFromRoute,
    (key) => {
      const canalId = canaisStore.currentCanalId
      if (!key || canalId == null) return
      if (conversasStore.conversaAtual !== key) {
        conversasStore.setConversaAtual(key, canalId)
      }
    },
    { immediate: true },
  )

  return {
    conversaKeyFromRoute,
    conversaKeyAtiva,
  }
}
