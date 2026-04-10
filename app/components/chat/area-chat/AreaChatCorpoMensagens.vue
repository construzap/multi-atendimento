<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import BalaoMensagem from '~/components/chat/area-chat/BalaoMensagens/BalaoMensagem.vue'
import { mensagensKey } from '~/stores/mensagens'

const canais = useCanaisStore()
const conversas = useConversasStore()
const mensagens = useMensagensStore()

const canalId = computed(() => canais.currentCanalId)
const lid = computed(() => conversas.conversaAtual)

const activeKey = computed(() => {
  if (!canalId.value || !lid.value) return null
  return mensagensKey(canalId.value, lid.value)
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
const shouldScrollOnOpen = ref(false)

function updateIsAtBottom() {
  const el = scroller.value
  if (!el) return
  const thresholdPx = 24
  isAtBottom.value = el.scrollTop + el.clientHeight >= el.scrollHeight - thresholdPx
}

async function scrollToBottom() {
  await nextTick()
  const el = scroller.value
  if (!el) return
  el.scrollTop = el.scrollHeight
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
  },
  { flush: 'post' }
)
</script>

<template>
  <div
    ref="scroller"
    class="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-2"
    @scroll="updateIsAtBottom"
  >
    <div class="my-6 flex justify-center">
      <span
        class="rounded-full bg-surface-container px-4 py-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant dark:bg-slate-800 dark:text-slate-400"
      >
        Hoje
      </span>
    </div>

    <div
      v-if="!canalId || !lid"
      class="rounded-xl border border-dashed border-slate-200 py-10 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400"
    >
      Selecione uma conversa para ver as mensagens.
    </div>

    <!-- Ancora mensagens no rodapé quando houver poucas (como WhatsApp Web). -->
    <div v-else class="flex min-h-full flex-col justify-end">
      <div class="flex flex-col">
        <BalaoMensagem v-for="m in mensagensOrdenadas" :key="m.message_id" :mensagem="m" />
      </div>
    </div>
  </div>
</template>
