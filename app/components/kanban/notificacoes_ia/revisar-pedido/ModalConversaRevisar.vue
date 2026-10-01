<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { EntregadorListaItem } from '#shared/types/entregadores'
import { storeToRefs } from 'pinia'
import { mensagemErroFetch } from '~/stores/canais'
import { useKanbanStore } from '~/stores/kanban'
import RevisarPedidoListaMensagens from './RevisarPedidoListaMensagens.vue'

const props = defineProps<{
  conversaKey: string
}>()

const emit = defineEmits<{
  fechar: []
  selecionarEntregador: [entregador: EntregadorListaItem | null]
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

    <RevisarPedidoListaMensagens
      :mensagens="mensagens"
      :eh-grupo="card?.is_group === true"
      :carregando="carregando"
      :erro="erro"
      @selecionar-entregador="emit('selecionarEntregador', $event)"
    />
  </aside>
</template>
