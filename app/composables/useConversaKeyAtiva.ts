/**
 * Key da conversa ativa no chat: Pinia `conversas.conversaAtual`.
 */
export function useConversaKeyAtiva() {
  const conversas = useConversasStore()

  const conversaKeyAtiva = computed(() => {
    const key = conversas.conversaAtual?.trim()
    return key || null
  })

  return {
    conversaKeyAtiva,
  }
}
