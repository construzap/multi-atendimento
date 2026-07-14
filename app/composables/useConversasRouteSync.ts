import {

  chatConversaPath,

  parseChatRouteParams,

  parseConversaKeyParam,

} from '~/utils/chatRouteParams'



/**

 * Aplica canal + conversa ativa nos stores a partir da rota (URL = fonte da verdade).

 */

export function aplicarConversaDaRota(canalId: number, conversaKey: string | null) {

  const canais = useCanaisStore()

  const conversas = useConversasStore()

  const mensagens = useMensagensStore()



  canais.setCurrentCanalId(canalId)

  conversas.setActiveCanalId(canalId)



  const key = conversaKey?.trim() || null

  conversas.setConversaAtual(key, canalId)

  mensagens.setActiveKey(key)



  if (key && !key.startsWith('temp:')) {

    void conversas.ensureConversaNaLista(canalId, key)

  }

}



/** Navega para conversa no chat e sincroniza Pinia antes da troca de rota. */

export function navegarParaConversaChat(

  workspaceId: number | string,

  canalId: number,

  conversaKey: string,

  options?: { replace?: boolean },

) {

  const cid = Math.trunc(canalId)

  const key = conversaKey.trim()

  if (!key || cid < 1) return Promise.resolve()



  aplicarConversaDaRota(cid, key)

  return navigateTo(chatConversaPath(workspaceId, cid, key), {

    replace: options?.replace ?? true,

  })

}



/**

 * Sincroniza Pinia com `route.params` quando a URL é de chat.

 * Usado pelo plugin global e pode ser chamado manualmente após navegação.

 */

export function syncConversasStoresFromRoute(route = useRoute()) {

  const parsed = parseChatRouteParams(route)

  if (!parsed) return

  aplicarConversaDaRota(parsed.canalId, parsed.conversaKey)

}



export function useConversasRouteSync() {

  const route = useRoute()



  const conversaKeyFromRoute = computed(() =>

    parseConversaKeyParam(route.params.conversaKey) || null,

  )



  const canalIdFromRoute = computed(() => parseChatRouteParams(route)?.canalId ?? null)



  return {

    conversaKeyFromRoute,

    canalIdFromRoute,

    aplicarConversaDaRota,

    navegarParaConversaChat,

    syncConversasStoresFromRoute,

  }

}


