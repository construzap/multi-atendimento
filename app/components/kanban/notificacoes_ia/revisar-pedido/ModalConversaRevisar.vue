<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { mensagemErroFetch } from '~/stores/canais'
import { useKanbanStore } from '~/stores/kanban'
import RevisarPedidoListaMensagens from './RevisarPedidoListaMensagens.vue'

const props = defineProps<{
  conversaKey: string
}>()

const emit = defineEmits<{
  fechar: []
}>()

const kanban = useKanbanStore()
const { columns } = storeToRefs(kanban)

const carregando = ref(true)
const erro = ref('')

const card = computed(() => {
  const key = props.conversaKey?.trim()
  if (!key) return null
  for (const col of columns.value) {
    const found = col.cards.find((c) => c.conversa_key === key)
    if (found) return found
  }
  return null
})

const mensagens = computed(() => card.value?.mensagens ?? [])

const nome = computed(() => {
  const c = card.value
  const n = c?.is_group ? c.name_group || c.name : c?.name
  return n?.trim() || c?.phone?.trim() || 'Conversa'
})

async function carregar() {
  const key = props.conversaKey?.trim()
  const canalId = card.value?.id_canal
  if (!key || canalId == null || canalId < 1) {
    erro.value = 'Esta conversa não tem canal para carregar as mensagens.'
    return
  }
  carregando.value = true
  erro.value = ''
  try {
    await kanban.carregarMensagensCard(key, canalId)
  } catch (err) {
    erro.value = mensagemErroFetch(err, 'Não foi possível carregar a conversa.')
  } finally {
    carregando.value = false
  }
}

onMounted(() => {
  void carregar()
})
</script>

<template>
  <aside class="flex min-h-0 min-w-0 flex-1 flex-col bg-surface-container-lowest dark:bg-dark-surface-container-lowest">
    <header class="flex shrink-0 items-center justify-between gap-3 border-b border-outline/30 px-4 py-3 dark:border-dark-outline/30">
      <div class="min-w-0">
        <p class="truncate text-sm font-bold text-on-surface dark:text-dark-on-surface">
          {{ nome }}
        </p>
        <p class="truncate text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
          Conversa para conferir o pedido
        </p>
      </div>
      <button
        type="button"
        class="rounded-xl p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface dark:text-dark-on-surface-variant dark:hover:bg-dark-surface-container-high dark:hover:text-dark-on-surface"
        aria-label="Fechar conversa"
        @click="emit('fechar')"
      >
        <span class="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
      </button>
    </header>

    <div
      v-if="carregando"
      class="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 bg-[#e5ddd5] dark:bg-[#0b141a]"
      role="status"
    >
      <span class="material-symbols-outlined animate-spin text-3xl text-primary-600 dark:text-primary-400" aria-hidden="true">
        progress_activity
      </span>
      <p class="text-sm text-zinc-800 dark:text-slate-200">Carregando mensagens…</p>
    </div>
    <div
      v-else-if="erro"
      class="flex min-h-0 flex-1 items-center justify-center bg-[#e5ddd5] px-4 dark:bg-[#0b141a]"
    >
      <p class="text-center text-sm text-red-700 dark:text-red-300">{{ erro }}</p>
    </div>
    <RevisarPedidoListaMensagens
      v-else
      :mensagens="mensagens"
      :eh-grupo="card?.is_group === true"
    />
  </aside>
</template>
