import AreaChat from '~/components/chat/area-chat.vue'
import AreaConversa from '~/components/chat/area-conversa.vue'
import AreaInfoConversa from '~/components/chat/area-info-conversa.vue'

function parsePositiveInt(raw: unknown): number | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  const n = Number.parseInt(s, 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return null
  if (String(n) !== s) return null
  return n
}

function parseConversaKeyParam(raw: unknown): string {
  const s = String(raw ?? '').trim()
  if (!s) return ''
  try {
    return decodeURIComponent(s).trim()
  } catch {
    return s
  }
}

type Options = {
  /** Lê `conversaKey` da rota e sincroniza com o Pinia (página com conversa na URL). */
  syncConversaFromRoute?: boolean
  /** Quando `conversaAtual` muda no Pinia, navega para a URL com a conversa. */
  syncConversaToRoute?: boolean
  /** Ao entrar na rota sem conversa, limpa a seleção no Pinia. */
  clearConversaOnEnter?: boolean
}

function isSameCanalChatPath(toPath: string, wid: number | null, cid: number | null): boolean {
  if (wid == null || cid == null) return false
  const base = `/workspaces/${wid}/chat/${cid}`
  return toPath === base || toPath.startsWith(`${base}/`)
}

export function useChatCanalPage(options: Options = {}) {
  const {
    syncConversaFromRoute = false,
    syncConversaToRoute = false,
    clearConversaOnEnter = false,
  } = options

  const route = useRoute()
  const canaisStore = useCanaisStore()
  const conversasStore = useConversasStore()

  const canalId = computed(() => parsePositiveInt(route.params.canalId))
  const workspaceId = computed(() => parsePositiveInt(route.params.id))
  const conversaKeyFromRoute = computed(() => parseConversaKeyParam(route.params.conversaKey))

  const cookieName = computed(() => {
    const wid = workspaceId.value
    return wid ? `last_chat_canal_ws_${wid}` : 'last_chat_canal_ws_0'
  })
  const lastCanalCookie = useCookie<string | null>(cookieName.value)

  const mobilePane = useState<'list' | 'chat' | 'info'>('chat_mobile_pane', () => 'list')
  /** Evita redirect para `/chat/:canal` ao sair do chat (ex.: voltar ao kanban). */
  const suppressConversaUrlSync = ref(false)

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

  const canalIdSnapshot = ref<number | null>(null)
  watch(
    canalId,
    (id) => {
      if (id != null) canalIdSnapshot.value = id
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
      (id) => {
        if (id != null) conversasStore.setConversaAtual(null, id)
      },
      { immediate: true },
    )
  }

  if (syncConversaFromRoute) {
    watch(
      conversaKeyFromRoute,
      (key) => {
        const id = canalId.value
        if (id == null) return
        if (key) {
          conversasStore.setConversaAtual(key, id)
          return
        }
        conversasStore.setConversaAtual(null, id)
      },
      { immediate: true },
    )
  }

  if (syncConversaToRoute) {
    watch(
      () => conversasStore.conversaAtual,
      (key) => {
        const wid = workspaceId.value
        const cid = canalId.value
        if (!key || wid == null || cid == null) return
        if (conversaKeyFromRoute.value === key) return
        void navigateTo(
          `/workspaces/${wid}/chat/${cid}/${encodeURIComponent(key)}`,
          { replace: true },
        )
      },
    )
  }

  if (syncConversaFromRoute) {
    watch(
      () => conversasStore.conversaAtual,
      (key) => {
        if (suppressConversaUrlSync.value) return
        const wid = workspaceId.value
        const cid = canalId.value
        if (wid == null || cid == null) return
        if (key) return
        if (!conversaKeyFromRoute.value) return
        if (!isSameCanalChatPath(route.path, wid, cid)) return
        void navigateTo(`/workspaces/${wid}/chat/${cid}`, { replace: true })
      },
    )
  }

  onBeforeRouteLeave((to) => {
    const id = canalIdSnapshot.value
    const wid = workspaceId.value
    if (id == null) return
    if (isSameCanalChatPath(to.path, wid, id)) return
    suppressConversaUrlSync.value = true
    conversasStore.setConversaAtual(null, id)
  })

  onMounted(async () => {
    suppressConversaUrlSync.value = false
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
