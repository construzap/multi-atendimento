import { chatConversaPath, parsePositiveIntParam } from '~/utils/chatRouteParams'

/**
 * Define canal + conversa ativa no Pinia (fonte da verdade da UI do chat).
 * Se estiver em rota de chat do workspace, sincroniza a URL com a conversa.
 */
export function selecionarConversaNoChat(canalId: number, conversaKey: string) {
  const canais = useCanaisStore()
  const conversas = useConversasStore()
  const mensagens = useMensagensStore()
  const route = useRoute()

  const cid = Math.trunc(canalId)
  const key = conversaKey.trim()
  if (!key || cid < 1) return

  canais.setCurrentCanalId(cid)
  conversas.setActiveCanalId(cid)
  conversas.setConversaAtual(key, cid)
  void mensagens.ensureLoaded(cid, key, 1)
  void conversas.marcarComoLida(key).catch(() => {})
  void conversas.ensureConversaNaLista(cid, key)

  const wid = parsePositiveIntParam(route.params.id)
  if (wid != null) {
    const target = chatConversaPath(wid, cid, key)
    if (route.path !== target) {
      void navigateTo(target, { replace: true })
    }
  }
}

/**
 * Vai para `/workspaces/:id/chat/:canalId/:conversaKey` e seleciona no Pinia.
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

  await navigateTo(chatConversaPath(workspaceId, cid, key), {
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
