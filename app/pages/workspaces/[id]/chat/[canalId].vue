<script setup lang="ts">
import AreaChat from '~/components/chat/area-chat.vue'
import AreaConversa from '~/components/chat/area-conversa.vue'
import AreaInfoConversa from '~/components/chat/area-info-conversa.vue'

definePageMeta({
  layout: 'workspace'
})

const route = useRoute()
const canaisStore = useCanaisStore()
const conversasStore = useConversasStore()

function parsePositiveInt(raw: unknown): number | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  const n = Number.parseInt(s, 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return null
  // Garante que não veio algo como "2abc"
  if (String(n) !== s) return null
  return n
}

const canalId = computed(() => parsePositiveInt(route.params.canalId))
const workspaceId = computed(() => parsePositiveInt(route.params.id))

const cookieName = computed(() => {
  const wid = workspaceId.value
  return wid ? `last_chat_canal_ws_${wid}` : 'last_chat_canal_ws_0'
})
const lastCanalCookie = useCookie<string | null>(cookieName.value)

/**
 * Navegação mobile do chat:
 * - list: lista de conversas
 * - chat: mensagens
 * - info: painel de contexto
 */
const mobilePane = useState<'list' | 'chat' | 'info'>('chat_mobile_pane', () => 'list')

watch(
  () => conversasStore.conversaAtual,
  (cur) => {
    // Selecionou conversa → abre chat; limpou → volta para lista.
    if (cur) {
      if (mobilePane.value === 'list') mobilePane.value = 'chat'
      return
    }
    if (mobilePane.value !== 'list') mobilePane.value = 'list'
  },
  { immediate: true },
)

/** Canal da rota no momento (para limpar seleção ao sair da página; a rota pode já ter mudado no `onUnmounted`). */
const canalIdSnapshot = ref<number | null>(null)
watch(
  canalId,
  (id) => {
    if (id != null) canalIdSnapshot.value = id
    // Salva sempre o último canal acessado para esse workspace (usado pelo /chat sem :canalId).
    if (id != null) lastCanalCookie.value = String(id)
  },
  { immediate: true }
)

watch(
  canalId,
  (id) => {
    if (id == null) {
      throw createError({ statusCode: 404, statusMessage: 'Canal inválido.' })
    }
    // Essa linha é o gatilho que o plugin observa para refazer a busca.
    canaisStore.setCurrentCanalId(id)

    // Se já temos a lista de canais do workspace e esse id não existe/pertence ao user,
    // redireciona para `/canais`.
    if (canaisStore.items.length > 0 && canaisStore.currentCanalId == null) {
      const wid = workspaceId.value
      if (wid != null) {
        navigateTo(`/workspaces/${wid}/canais`, { replace: true })
      } else {
        navigateTo('/', { replace: true })
      }
    }
  },
  { immediate: true }
)

onMounted(async () => {
  const wid = workspaceId.value
  if (wid != null) {
    await canaisStore.ensureCanaisLoaded(wid).catch(() => {})
    // Depois do fetch, garante que o objeto completo seja preenchido (se existir na lista).
    if (canalId.value != null) canaisStore.setCurrentCanalId(canalId.value)

    // Se o canal da URL não pertence ao usuário (não está em items), manda para `/canais`.
    if (canalId.value != null && canaisStore.currentCanalId == null) {
      await navigateTo(`/workspaces/${wid}/canais`, { replace: true })
    }
  }
})

onUnmounted(() => {
  const id = canalIdSnapshot.value
  if (id != null) conversasStore.setConversaAtual(null, id)
})
</script>

<template>
  <!-- Altura própria: não depende de flex no layout global (evita alterar outras páginas). -->
  <!-- Desktop: 3 colunas -->
  <div class="hidden h-[100dvh] min-h-0 w-full flex-row overflow-hidden md:flex">
    <AreaConversa />
    <AreaChat />
    <AreaInfoConversa />
  </div>

  <!-- Mobile: 1 tela por vez -->
  <div class="flex h-[100dvh] min-h-0 w-full flex-row overflow-hidden md:hidden">
    <AreaConversa v-if="mobilePane === 'list'" />
    <AreaChat v-else-if="mobilePane === 'chat'" />
    <AreaInfoConversa v-else />
  </div>
</template>
