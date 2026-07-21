import AreaChat from '~/components/chat/area-chat.vue'
import AreaConversa from '~/components/chat/area-conversa.vue'
import AreaInfoConversa from '~/components/chat/area-info-conversa.vue'
import { parsePositiveIntParam } from '~/utils/chatRouteParams'

function isWorkspaceChatPath(path: string, wid: number | null): boolean {
  if (wid == null) return false
  const base = `/workspaces/${wid}/chat`
  return path === base || path.startsWith(`${base}/`)
}

type Options = {
  /** Ao entrar no canal, limpa a conversa selecionada no Pinia. */
  clearConversaOnEnter?: boolean
}

/**
 * Layout do chat por canal. Seleção de conversa = Pinia (`conversas.conversaAtual`).
 */
export function useChatCanalPage(options: Options = {}) {
  const { clearConversaOnEnter = false } = options

  const route = useRoute()
  const canaisStore = useCanaisStore()
  const conversasStore = useConversasStore()
  const mensagensStore = useMensagensStore()

  const canalId = computed(() => parsePositiveIntParam(route.params.canalId))
  const workspaceId = computed(() => parsePositiveIntParam(route.params.id))

  const cookieName = computed(() => {
    const wid = workspaceId.value
    return wid ? `last_chat_canal_ws_${wid}` : 'last_chat_canal_ws_0'
  })
  const lastCanalCookie = useCookie<string | null>(cookieName.value)

  const mobilePane = useState<'list' | 'chat' | 'info'>('chat_mobile_pane', () => 'list')

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
    (id) => {
      if (id == null) {
        throw createError({ statusCode: 404, statusMessage: 'Canal inválido.' })
      }
      canaisStore.setCurrentCanalId(id)
      conversasStore.setActiveCanalId(id)

      if (canaisStore.items.length > 0 && canaisStore.currentCanalId == null) {
        const wid = workspaceId.value
        if (wid != null) {
          navigateTo(`/workspaces/${wid}/canais`, { replace: true })
        } else {
          navigateTo('/', { replace: true })
        }
      }
    },
    { immediate: true },
  )

  if (clearConversaOnEnter) {
    watch(
      canalId,
      (id, prev) => {
        // Só limpa ao trocar de canal — não ao montar (ex.: veio do kanban com seleção).
        if (id == null || prev == null) return
        if (id === prev) return
        conversasStore.setConversaAtual(null, id)
        mensagensStore.setActiveKey(null)
      },
    )
  }

  function limparConversaAoSairDoChat() {
    conversasStore.clearAllConversaAtual()
    mensagensStore.setActiveKey(null)
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
