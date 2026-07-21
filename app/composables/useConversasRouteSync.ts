import { chatCanalPath, parsePositiveIntParam } from '~/utils/chatRouteParams'

/**
 * Define canal + conversa ativa no Pinia (fonte da verdade da UI do chat).
 */
export function selecionarConversaNoChat(canalId: number, conversaKey: string) {
  const canais = useCanaisStore()
  const conversas = useConversasStore()
  const mensagens = useMensagensStore()

  const cid = Math.trunc(canalId)
  const key = conversaKey.trim()
  if (!key || cid < 1) return

  canais.setCurrentCanalId(cid)
  conversas.setActiveCanalId(cid)
  conversas.setConversaAtual(key, cid)
  void mensagens.ensureLoaded(cid, key, 1)
  void conversas.marcarComoLida(key).catch(() => {})
  void conversas.ensureConversaNaLista(cid, key)
}

/**
 * Vai para `/workspaces/:id/chat/:canalId` e seleciona a conversa no Pinia
 * (sem colocar a key na URL). Seleciona depois do navigate para não perder
 * a seleção se a página limpar ao trocar de canal.
 */
export async function abrirConversaNoChat(
  workspaceId: number | string,
  canalId: number,
  conversaKey: string,
  options?: { replace?: boolean },
) {
  const cid = Math.trunc(canalId)
  const key = conversaKey.trim()
  if (!key || cid < 1) return

  await navigateTo(chatCanalPath(workspaceId, cid), {
    replace: options?.replace ?? true,
  })
  selecionarConversaNoChat(cid, key)
}

/** @deprecated Use `abrirConversaNoChat`. */
export function navegarParaConversaChat(
  workspaceId: number | string,
  canalId: number,
  conversaKey: string,
  options?: { replace?: boolean },
) {
  return abrirConversaNoChat(workspaceId, canalId, conversaKey, options)
}

export function useConversasRouteSync() {
  const route = useRoute()

  const canalIdFromRoute = computed(() => parsePositiveIntParam(route.params.canalId))

  return {
    canalIdFromRoute,
    selecionarConversaNoChat,
    abrirConversaNoChat,
    navegarParaConversaChat,
  }
}
