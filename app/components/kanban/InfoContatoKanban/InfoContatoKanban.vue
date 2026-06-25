<script setup lang="ts">
import { computed, onUnmounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import InfoContatoConversa from '~/components/InfoContatoConversa.vue'
import KanbanInfoContatoConversaCampos from './KanbanInfoContatoConversaCampos.vue'
import KanbanInfoContatoConversaChat from './KanbanInfoContatoConversaChat.vue'
import type { InfoContatoConversaData } from '#shared/types/infoContatoConversa'
import { useKanbanStore } from '~/stores/kanban'

const kanban = useKanbanStore()
const { infoContatoConversaKey, infoContatoCard, infoContatoColumn } = storeToRefs(kanban)

const isOpen = computed({
  get: () => infoContatoConversaKey.value != null,
  set: (v: boolean) => {
    if (!v) kanban.closeInfoContatoConversa()
  },
})

const contato = computed((): InfoContatoConversaData | null => {
  const card = infoContatoCard.value
  if (!card) return null

  return {
    conversa_key: card.conversa_key,
    name: card.name,
    phone: card.phone,
    photo: card.photo,
    preview: card.preview,
    updated_at: card.updated_at,
    canal_nome: card.canal_nome,
    prioridade: card.prioridade,
    etapa_nome: infoContatoColumn.value?.nome ?? null,
  }
})

function fechar() {
  isOpen.value = false
}

function onBackdropClick() {
  fechar()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') fechar()
}

watch(
  isOpen,
  (open) => {
    if (!process.client) return
    if (open) {
      document.addEventListener('keydown', onKeydown)
    } else {
      document.removeEventListener('keydown', onKeydown)
    }
  },
  { immediate: true },
)

onUnmounted(() => {
  if (!process.client) return
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isOpen"
        class="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-label="Informações do contato e chat"
        @click.self="onBackdropClick"
      >
        <Transition
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="opacity-0 translate-y-2 scale-95"
          enter-to-class="opacity-100 translate-y-0 scale-100"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="opacity-100 translate-y-0 scale-100"
          leave-to-class="opacity-0 translate-y-2 scale-95"
        >
          <div
            v-if="isOpen"
            class="flex h-[min(90vh,720px)] w-full max-w-4xl overflow-hidden rounded-2xl border border-outline/40 bg-surface-container-lowest shadow-xl dark:border-dark-outline/40 dark:bg-dark-surface-container-low"
            @click.stop
          >
            <InfoContatoConversa v-model:open="isOpen" embedded :contato="contato">
              <KanbanInfoContatoConversaCampos />
            </InfoContatoConversa>
            <KanbanInfoContatoConversaChat />
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
