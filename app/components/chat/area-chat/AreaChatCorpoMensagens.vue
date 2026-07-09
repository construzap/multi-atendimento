<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import BalaoMensagem from '~/components/chat/area-chat/BalaoMensagens/BalaoMensagem.vue'

const conversas = useConversasStore()
const mensagens = useMensagensStore()
const { conversaKeyAtiva } = useConversaKeyAtiva()

const activeKey = conversaKeyAtiva

const ehGrupo = computed(() => {
  const key = activeKey.value
  if (!key) return false
  const c = conversas.items.find((i) => i.key === key)
  return c?.is_group === true
})

watch(
  activeKey,
  (k) => {
    mensagens.setActiveKey(k)
  },
  { immediate: true }
)

// API vem mais recente primeiro; para UI tipo WhatsApp (de cima para baixo),
// exibimos do mais antigo para o mais novo e ancoramos o bloco no rodapé.
const mensagensOrdenadas = computed(() => [...mensagens.items].reverse())

const scroller = ref<HTMLElement | null>(null)
const isAtBottom = ref(true)
/** Próximo do topo do rolagem (para exibir “Carregar mais mensagens”). */
const isAtTop = ref(true)
const shouldScrollOnOpen = ref(false)

const TOP_THRESHOLD_PX = 80

function updateIsAtBottom() {
  const el = scroller.value
  if (!el) return
  const thresholdPx = 24
  isAtBottom.value = el.scrollTop + el.clientHeight >= el.scrollHeight - thresholdPx
}

function updateIsAtTop() {
  const el = scroller.value
  if (!el) return
  isAtTop.value = el.scrollTop <= TOP_THRESHOLD_PX
}

function onScrollerScroll() {
  updateIsAtBottom()
  updateIsAtTop()
}

async function scrollToBottom() {
  await nextTick()
  const el = scroller.value
  if (!el) return
  el.scrollTop = el.scrollHeight
}

/** Botão “rolar ao fim”: só quando há conversa aberta e o usuário não está no rodapé. */
const showScrollDownFab = computed(() => {
  if (!activeKey.value) return false
  return !isAtBottom.value
})

async function onFabScrollToBottom() {
  await scrollToBottom()
  updateIsAtBottom()
  updateIsAtTop()
}

/** Próximo ao topo da lista (carregar mais fica visível; vazio → toast). */
const showLoadMoreFab = computed(() => {
  if (!activeKey.value) return false
  return isAtTop.value
})

async function onLoadMoreMensagens() {
  const el = scroller.value
  if (!el || mensagens.pending) return

  const prevHeight = el.scrollHeight
  const prevTop = el.scrollTop

  try {
    const added = await mensagens.fetchNextPage()
    if (added === 0) {
      toast.info('Não há mais mensagens para serem carregadas.', { duration: 4000 })
      return
    }
  } catch {
    return
  }

  await nextTick()
  requestAnimationFrame(() => {
    const box = scroller.value
    if (!box) return
    const delta = box.scrollHeight - prevHeight
    box.scrollTop = prevTop + delta
    updateIsAtTop()
    updateIsAtBottom()
  })
}

// Ao abrir/trocar de conversa, sempre rola até o fim (mensagens mais recentes).
watch(
  activeKey,
  async (k) => {
    if (!k) return
    shouldScrollOnOpen.value = true
    await scrollToBottom()
    shouldScrollOnOpen.value = false
    updateIsAtBottom()
    updateIsAtTop()
  },
  { flush: 'post' }
)

// Quando novas mensagens chegarem: se o usuário já estava no fim, mantém no fim.
watch(
  () => mensagensOrdenadas.value.length,
  async () => {
    if (shouldScrollOnOpen.value) return
    if (!isAtBottom.value) return
    await scrollToBottom()
    updateIsAtBottom()
    updateIsAtTop()
  },
  { flush: 'post' }
)
</script>

<template>
  <div class="relative flex min-h-0 flex-1 flex-col">
    <div
      ref="scroller"
      class="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6 py-2 sm:px-8"
      @scroll="onScrollerScroll"
    >
      <div class="my-6 flex justify-center">
        <span
          class="rounded-full bg-surface-container px-4 py-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant dark:bg-slate-800 dark:text-slate-400"
        >
          Hoje
        </span>
      </div>

      <div
        v-if="!activeKey"
        class="rounded-xl border border-dashed border-slate-200 py-10 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400"
      >
        Selecione uma conversa para ver as mensagens.
      </div>

      <!-- Ancora mensagens no rodapé quando houver poucas (como WhatsApp Web). -->
      <div v-else class="flex min-h-full flex-col justify-end">
        <div class="flex flex-col">
          <BalaoMensagem
            v-for="m in mensagensOrdenadas"
            :key="m.temp_id ?? m.message_id"
            :mensagem="m"
            :eh-grupo="ehGrupo"
          />
        </div>
      </div>
    </div>

    <Transition name="fab-scroll">
      <button
        v-if="showScrollDownFab"
        type="button"
        class="absolute bottom-5 left-6 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-slate-200/90 bg-white text-slate-600 shadow-lg ring-1 ring-black/5 transition hover:bg-slate-50 active:scale-95 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:ring-white/10 dark:hover:bg-slate-700 sm:left-8"
        aria-label="Ir para a mensagem mais recente"
        @click="onFabScrollToBottom"
      >
        <span class="material-symbols-outlined text-[26px]" aria-hidden="true">expand_more</span>
      </button>
    </Transition>

    <Transition name="fab-load-top">
      <button
        v-if="showLoadMoreFab"
        type="button"
        class="absolute left-1/2 top-5 z-10 max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-full border border-slate-200/90 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-lg ring-1 ring-black/5 transition hover:bg-slate-50 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:ring-white/10 dark:hover:bg-slate-700 sm:text-sm"
        :disabled="mensagens.pending"
        aria-label="Carregar mensagens mais antigas"
        @click="onLoadMoreMensagens"
      >
        {{ mensagens.pending ? 'Carregando…' : 'Carregar mais mensagens' }}
      </button>
    </Transition>
  </div>
</template>

<style scoped>
.fab-scroll-enter-active,
.fab-scroll-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.fab-scroll-enter-from,
.fab-scroll-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

.fab-load-top-enter-active,
.fab-load-top-leave-active {
  transition: opacity 0.2s ease;
}
.fab-load-top-enter-from,
.fab-load-top-leave-to {
  opacity: 0;
}
</style>
