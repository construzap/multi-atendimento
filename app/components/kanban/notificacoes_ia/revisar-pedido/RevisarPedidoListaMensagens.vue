<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import type { EntregadorListaItem, EntregadoresListResponse } from '#shared/types/entregadores'
import type { Mensagem } from '#shared/types/mensagem'
import { dayKeyFromIso, labelDiaChat } from '#shared/utils/chatDiaLabel'
import BalaoMensagem from '~/components/chat/area-chat/BalaoMensagens/BalaoMensagem.vue'
import { mensagemErroFetch } from '~/stores/canais'
import { useWorkspacesStore } from '~/stores/workspaces'

const props = defineProps<{
  mensagens: Mensagem[]
  ehGrupo?: boolean
  carregando?: boolean
  erro?: string
}>()

const emit = defineEmits<{
  selecionarEntregador: [entregador: EntregadorListaItem | null]
}>()

const workspaces = useWorkspacesStore()
const painelEntregadoresAberto = ref(false)
const carregandoEntregadores = ref(false)
const entregadores = ref<EntregadorListaItem[]>([])
const entregadorSelecionado = ref<EntregadorListaItem | null>(null)

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

async function abrirEntregadores() {
  if (painelEntregadoresAberto.value) {
    painelEntregadoresAberto.value = false
    return
  }
  const workspaceId = Number.parseInt(String(workspaces.currentWorkspaceId ?? '').trim(), 10)
  if (!Number.isFinite(workspaceId) || workspaceId < 1) {
    toast.error('Workspace atual não encontrado.')
    return
  }
  painelEntregadoresAberto.value = true
  if (entregadores.value.length > 0) return
  carregandoEntregadores.value = true
  try {
    const res = await $fetch<EntregadoresListResponse>('/api/entregadores', {
      method: 'GET',
      query: { workspace_id: workspaceId },
    })
    entregadores.value = (res.data ?? []).filter((e) => e.ativo)
  } catch (err) {
    painelEntregadoresAberto.value = false
    toast.error(mensagemErroFetch(err, 'Não foi possível carregar os entregadores.'))
  } finally {
    carregandoEntregadores.value = false
  }
}

function escolherEntregador(entregador: EntregadorListaItem) {
  entregadorSelecionado.value = entregador
  painelEntregadoresAberto.value = false
  emit('selecionarEntregador', entregador)
}

function limparEntregador() {
  entregadorSelecionado.value = null
  emit('selecionarEntregador', null)
}
</script>

<template>
  <div class="flex min-h-0 min-w-0 flex-1 flex-col">
  <div
    ref="scroller"
    class="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-[#e5ddd5] px-3 py-3 dark:bg-[#0b141a]"
  >
    <div
      v-if="carregando"
      class="flex min-h-full flex-col items-center justify-center gap-2"
      role="status"
    >
      <span class="material-symbols-outlined animate-spin text-3xl text-primary-600 dark:text-primary-400" aria-hidden="true">
        progress_activity
      </span>
      <p class="text-sm text-zinc-800 dark:text-slate-200">Carregando mensagens…</p>
    </div>
    <p
      v-else-if="erro"
      class="py-10 text-center text-sm text-red-700 dark:text-red-300"
    >
      {{ erro }}
    </p>
    <p
      v-else-if="mensagens.length === 0"
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
    <div class="relative shrink-0 border-t border-black/10 bg-[#f0f2f5] px-3 py-2 dark:border-white/10 dark:bg-[#202c33]">
      <div
        v-if="painelEntregadoresAberto"
        class="absolute bottom-full left-3 right-3 z-20 mb-1 max-h-52 overflow-y-auto rounded-xl border border-outline/30 bg-white shadow-lg dark:border-dark-outline/40 dark:bg-slate-900"
      >
        <p v-if="carregandoEntregadores" class="px-3 py-2 text-sm text-zinc-600 dark:text-slate-300">
          Carregando…
        </p>
        <p
          v-else-if="entregadores.length === 0"
          class="px-3 py-2 text-sm text-zinc-600 dark:text-slate-300"
        >
          Nenhum entregador ativo neste workspace.
        </p>
        <button
          v-for="entregador in entregadores"
          :key="entregador.id"
          type="button"
          class="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-slate-800"
          @click="escolherEntregador(entregador)"
        >
          <span class="min-w-0 truncate font-medium text-zinc-900 dark:text-slate-100">{{ entregador.nome }}</span>
          <span class="shrink-0 text-xs text-zinc-500 dark:text-slate-400">{{ entregador.codigo }}</span>
        </button>
      </div>
      <button
        type="button"
        class="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600"
        @click="abrirEntregadores"
      >
        <span class="material-symbols-outlined text-[18px]" aria-hidden="true">two_wheeler</span>
        {{ entregadorSelecionado ? entregadorSelecionado.nome : 'Adicionar entregador' }}
      </button>
      <button
        v-if="entregadorSelecionado"
        type="button"
        class="mt-1 w-full text-center text-[11px] font-medium text-zinc-600 underline dark:text-slate-300"
        @click="limparEntregador"
      >
        Remover entregador
      </button>
    </div>
  </div>
</template>
