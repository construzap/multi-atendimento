<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { Mensagem } from '#shared/types/mensagem'
import { dayKeyFromIso, labelDiaChat } from '#shared/utils/chatDiaLabel'
import BalaoMensagem from '~/components/chat/area-chat/BalaoMensagens/BalaoMensagem.vue'

const props = defineProps<{
  mensagens: Mensagem[]
  ehGrupo?: boolean
}>()

type TimelineItem =
  | { kind: 'day'; key: string; label: string }
  | { kind: 'msg'; key: string; mensagem: Mensagem }

const scroller = ref<HTMLElement | null>(null)

/** API devolve a mais recente primeiro; a lista mostra da mais antiga para a mais nova. */
const ordenadas = computed(() => [...props.mensagens].reverse())

const timeline = computed<TimelineItem[]>(() => {
  const out: TimelineItem[] = []
  let lastDay: string | null = null
  const agora = new Date()
  for (const m of ordenadas.value) {
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
      key: m.message_id,
      mensagem: m,
    })
  }
  return out
})

async function scrollToBottom() {
  await nextTick()
  const el = scroller.value
  if (!el) return
  el.scrollTop = el.scrollHeight
}

watch(
  () => props.mensagens.length,
  () => {
    void scrollToBottom()
  },
  { immediate: true },
)
</script>

<template>
  <div
    ref="scroller"
    class="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-[#e5ddd5] px-3 py-3 dark:bg-[#0b141a]"
  >
    <p
      v-if="mensagens.length === 0"
      class="py-10 text-center text-sm text-zinc-700 dark:text-slate-300"
    >
      Nenhuma mensagem nesta conversa.
    </p>
    <div v-else class="flex min-h-full flex-col justify-end">
      <div class="flex flex-col gap-0.5">
        <template v-for="item in timeline" :key="item.key">
          <div v-if="item.kind === 'day'" class="my-3 flex justify-center">
            <span
              class="rounded-lg bg-[#e1f2dc] px-3 py-1 text-[12px] font-medium text-zinc-800 shadow-sm dark:bg-slate-700 dark:text-slate-200"
            >
              {{ item.label }}
            </span>
          </div>
          <BalaoMensagem
            v-else
            :mensagem="item.mensagem"
            :eh-grupo="ehGrupo === true"
            somente-leitura
          />
        </template>
      </div>
    </div>
  </div>
</template>
