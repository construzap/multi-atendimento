<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import type { Mensagem } from '#shared/types/mensagem'
import { dayKeyFromIso, labelDiaChat } from '#shared/utils/chatDiaLabel'
import BalaoMensagem from '~/components/chat/area-chat/BalaoMensagens/BalaoMensagem.vue'

type TimelineItem =
  | { kind: 'day'; key: string; label: string }
  | { kind: 'msg'; key: string; mensagem: Mensagem }

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
  { immediate: true },
)

// API vem mais recente primeiro; para UI tipo WhatsApp (de cima para baixo),
// exibimos do mais antigo para o mais novo e ancoramos o bloco no rodapé.
const mensagensOrdenadas = computed(() => [...mensagens.items].reverse())

const timeline = computed<TimelineItem[]>(() => {
  const out: TimelineItem[] = []
  let lastDay: string | null = null
  const agora = new Date()

  for (const m of mensagensOrdenadas.value) {
    const dayKey = dayKeyFromIso(m.created_at) ?? 'sem-data'
    if (dayKey !== lastDay) {
      lastDay = dayKey
      out.push({
        kind: 'day',
        key: `day-${dayKey}`,
        label: labelDiaChat(m.created_at, agora) || dayKey,
      })
    }
    out.push({
      kind: 'msg',
      key: m.temp_id ?? m.message_id,
      mensagem: m,
    })
  }
  return out
})

const scroller = ref<HTMLElement | null>(null)
const isAtBottom = ref(true)
/** Próximo do topo do rolagem (para exibir “Carregar mais mensagens”). */
const isAtTop = ref(true)
const shouldScrollOnOpen = ref(false)

/** Pill flutuante (estilo WhatsApp) com o dia visível ao rolar. */
const stickyDayLabel = ref('')
const stickyDayVisible = ref(false)
let stickyHideTimer: ReturnType<typeof setTimeout> | null = null

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

function updateStickyDay() {
  const el = scroller.value
  if (!el) return

  const markers = el.querySelectorAll<HTMLElement>('[data-day-divider]')
  if (markers.length === 0) {
    stickyDayLabel.value = ''
    return
  }

  const boxTop = el.getBoundingClientRect().top
  const threshold = boxTop + 56
  let label = ''

  for (const marker of markers) {
    if (marker.getBoundingClientRect().top <= threshold) {
      label = marker.dataset.dayLabel ?? ''
    }
  }

  if (label) stickyDayLabel.value = label
}

function showStickyDayTemporarily() {
  updateStickyDay()
  if (!stickyDayLabel.value) return
  stickyDayVisible.value = true
  if (stickyHideTimer) clearTimeout(stickyHideTimer)
  stickyHideTimer = setTimeout(() => {
    stickyDayVisible.value = false
    stickyHideTimer = null
  }, 1200)
}

function onScrollerScroll() {
  updateIsAtBottom()
  updateIsAtTop()
  showStickyDayTemporarily()
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
  return isAtTop.value && mensagens.hasMore
})

async function onLoadMoreMensagens() {
  const el = scroller.value
  if (!el || mensagens.pending) return

  const prevHeight = el.scrollHeight
  const prevTop = el.scrollTop

  try {
    const added = await mensagens.fetchNextPage()
    if (added === 0) {
      toast.info('Não há mais mensagens para serem carregadas.', { duration: 2500 })
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
    updateStickyDay()
  })
}

// Ao abrir/trocar de conversa, sempre rola até o fim (mensagens mais recentes).
watch(
  activeKey,
  async (k) => {
    stickyDayVisible.value = false
    stickyDayLabel.value = ''
    if (!k) return
    shouldScrollOnOpen.value = true
    await scrollToBottom()
    shouldScrollOnOpen.value = false
    updateIsAtBottom()
    updateIsAtTop()
    updateStickyDay()
  },
  { flush: 'post' },
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
    updateStickyDay()
  },
  { flush: 'post' },
)

onBeforeUnmount(() => {
  if (stickyHideTimer) clearTimeout(stickyHideTimer)
})
</script>

<template>
  <div class="relative flex min-h-0 flex-1 flex-col">
    <!-- Pill flutuante do dia (some após parar de rolar) -->
    <Transition name="day-sticky">
      <div
        v-if="stickyDayVisible && stickyDayLabel"
        class="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2"
        aria-hidden="true"
      >
        <span
          class="inline-block rounded-lg bg-[#e1f2dc] px-3 py-1 text-[12px] font-medium text-zinc-800 shadow-sm dark:bg-slate-700 dark:text-slate-200"
        >
          {{ stickyDayLabel }}
        </span>
      </div>
    </Transition>

    <div
      ref="scroller"
      class="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6 py-2 sm:px-8"
      @scroll="onScrollerScroll"
    >
      <div
        v-if="!activeKey"
        class="rounded-xl border border-dashed border-slate-200 py-10 text-center text-xs text-zinc-700 dark:border-slate-700 dark:text-slate-400"
      >
        Selecione uma conversa para ver as mensagens.
      </div>

      <!-- Ancora mensagens no rodapé quando houver poucas (como WhatsApp Web). -->
      <div v-else class="flex min-h-full flex-col justify-end">
        <div class="flex flex-col">
          <template v-for="item in timeline" :key="item.key">
            <div
              v-if="item.kind === 'day'"
              class="my-3 flex justify-center"
              data-day-divider
              :data-day-label="item.label"
            >
              <span
                class="rounded-lg bg-[#e1f2dc] px-3 py-1 text-[12px] font-medium text-zinc-800 shadow-sm dark:bg-slate-700 dark:text-slate-200"
              >
                {{ item.label }}
              </span>
            </div>
            <BalaoMensagem
              v-else
              :mensagem="item.mensagem"
              :eh-grupo="ehGrupo"
            />
          </template>
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

.day-sticky-enter-active,
.day-sticky-leave-active {
  transition: opacity 0.22s ease;
}
.day-sticky-enter-from,
.day-sticky-leave-to {
  opacity: 0;
}
</style>
