import AreaChat from '~/components/chat/area-chat.vue'
import AreaConversa from '~/components/chat/area-conversa.vue'
import AreaInfoConversa from '~/components/chat/area-info-conversa.vue'
import { parseConversaKeyParam, parsePositiveIntParam } from '~/utils/chatRouteParams'

function isWorkspaceChatPath(path: string, wid: number | null): boolean {
  if (wid == null) return false
  const base = `/workspaces/${wid}/chat`
  return path === base || path.startsWith(`${base}/`)
}

/**
 * Layout do chat por canal.
 * - Ao abrir/trocar canal: GET `/api/conversas` → Pinia `byCanal[id].items`
 * - Conversa ativa fica em Pinia (`conversaAtual`), não na URL
 * - Se a URL ainda tiver `conversaKey` (link antigo): hidrata o Pinia e normaliza a URL
 */
export function useChatCanalPage() {
  const route = useRoute()
  const canaisStore = useCanaisStore()
  const conversasStore = useConversasStore()
  const mensagensStore = useMensagensStore()

  const canalId = computed(() => parsePositiveIntParam(route.params.canalId))
  const workspaceId = computed(() => parsePositiveIntParam(route.params.id))
  const conversaKeyFromRoute = computed(() => parseConversaKeyParam(route.params.conversaKey))

  const cookieName = computed(() => {
    const wid = workspaceId.value
    return wid ? `last_chat_canal_ws_${wid}` : 'last_chat_canal_ws_0'
  })
  const lastCanalCookie = useCookie<string | null>(cookieName.value)

  const mobilePane = useState<'list' | 'chat' | 'info'>('chat_mobile_pane', () => 'list')

  /** Evita refetch da lista quando só a conversa muda. */
  let lastListaCanalId: number | null = null
  let loadSeq = 0

  watch(
    () => conversasStore.conversaAtual,
    (cur) => {
      if (cur) {
        if (mobilePane.value === 'list') mobilePane.value = 'chat'
        return
      }
      if (mobilePane.value !== 'list') mobilePane.value = 'list'
    },
    { immediate: true },
  )

  watch(
    canalId,
    (id) => {
      if (id != null) lastCanalCookie.value = String(id)
    },
    { immediate: true },
  )

  watch(
    canalId,
    async (id) => {
      if (id == null) {
        throw createError({ statusCode: 404, statusMessage: 'Canal inválido.' })
      }

      const seq = ++loadSeq

      canaisStore.setCurrentCanalId(id)
      conversasStore.setActiveCanalId(id)

      if (canaisStore.items.length > 0 && canaisStore.currentCanalId == null) {
        const wid = workspaceId.value
        if (wid != null) {
          await navigateTo(`/workspaces/${wid}/canais`, { replace: true })
        } else {
          await navigateTo('/', { replace: true })
        }
        return
      }

      if (lastListaCanalId !== id) {
        try {
          await conversasStore.fetchPage(1, id, conversasStore.resolveFetchOptions())
        } catch {
          /* erro em conversas.error */
        }
        if (seq !== loadSeq) return
        lastListaCanalId = id
      }

      const keyFromRoute = conversaKeyFromRoute.value
      if (keyFromRoute) {
        await conversasStore.ensureConversaNaLista(id, keyFromRoute)
        if (seq !== loadSeq) return
        conversasStore.setConversaAtual(keyFromRoute, id)
        void mensagensStore.ensureLoaded(id, keyFromRoute, 1).catch(() => {})
      }
      // Sem key na URL: não zera Pinia — a seleção vive em `byCanal[id].conversaAtual`.
    },
    { immediate: true },
  )

  // Links antigos `/chat/:canalId/:conversaKey` → hidrata Pinia (canal watch também cobre).
  watch(
    conversaKeyFromRoute,
    async (key) => {
      const id = canalId.value
      if (!key || id == null) return
      await conversasStore.ensureConversaNaLista(id, key)
      conversasStore.setConversaAtual(key, id)
      void mensagensStore.ensureLoaded(id, key, 1).catch(() => {})
    },
  )

  function limparConversaAoSairDoChat() {
    conversasStore.clearAllConversaAtual()
    mensagensStore.setActiveKey(null)
    lastListaCanalId = null
  }

  onBeforeRouteLeave((to) => {
    const wid = workspaceId.value
    if (wid == null) return
    if (isWorkspaceChatPath(to.path, wid)) return
    limparConversaAoSairDoChat()
  })

  onBeforeUnmount(() => {
    const wid = workspaceId.value
    if (wid == null) return
    const router = useRouter()
    const destino = router.currentRoute.value.path
    if (isWorkspaceChatPath(destino, wid)) return
    limparConversaAoSairDoChat()
  })

  onMounted(async () => {
    const wid = workspaceId.value
    if (wid != null) {
      await canaisStore.ensureCanaisLoaded(wid).catch(() => {})
      if (canalId.value != null) canaisStore.setCurrentCanalId(canalId.value)

      if (canalId.value != null && canaisStore.currentCanalId == null) {
        await navigateTo(`/workspaces/${wid}/canais`, { replace: true })
      }
    }
  })

  return {
    AreaChat,
    AreaConversa,
    AreaInfoConversa,
    mobilePane,
  }
}
