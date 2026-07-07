<script setup lang="ts">
import { computed } from 'vue'
import BaseButton from './BaseButton.vue'
import BaseModal from './BaseModal.vue'
import Detalhes from './kanban/InfoContatoKanban/Detalhes.vue'
import type { InfoContatoConversaData } from '#shared/types/infoContatoConversa'

const props = withDefaults(
  defineProps<{
    open: boolean
    contato: InfoContatoConversaData | null
    /** Sem overlay próprio; pensado para uso lado a lado (ex.: kanban + chat). */
    embedded?: boolean
    /** Permite editar campos da conversa via PATCH /api/kanban/conversa. */
    conversaEditavel?: boolean
    /** @deprecated use conversaEditavel */
    nomeEditavel?: boolean
    workspaceId?: number | null
  }>(),
  {
    embedded: false,
    conversaEditavel: false,
    nomeEditavel: false,
    workspaceId: null,
  },
)

const emit = defineEmits<{
  'update:open': [value: boolean]
  nomeSalvo: [name: string | null]
}>()

function propEditavelAtivo(v: boolean | undefined): boolean {
  return v === true || (v as unknown) === ''
}

const editavel = computed(
  () => propEditavelAtivo(props.conversaEditavel) || propEditavelAtivo(props.nomeEditavel),
)

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})

function fechar() {
  isOpen.value = false
}
</script>

<template>
  <BaseModal
    v-if="!embedded"
    v-model:open="isOpen"
    title="Informações do contato"
    panel-class="w-full max-w-md"
  >
    <template v-if="contato" #subtitle>
      Detalhes da conversa
    </template>

    <template #icon>
      <span class="material-symbols-outlined text-[22px]" aria-hidden="true">person</span>
    </template>

    <Detalhes
      v-if="contato"
      :contato="contato"
      :conversa-editavel="editavel"
      :workspace-id="workspaceId"
      @nome-salvo="emit('nomeSalvo', $event)"
    >
      <slot name="etapa-funil" />
      <slot />
    </Detalhes>

    <p v-else class="text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
      Contato não encontrado.
    </p>

    <template #footer>
      <div class="w-full sm:w-32">
        <BaseButton type="button" variant="secondary" @click="fechar">
          Fechar
        </BaseButton>
      </div>
    </template>
  </BaseModal>

  <div
    v-else
    class="flex min-h-0 w-full max-w-md shrink-0 flex-col overflow-hidden border-r border-outline/30 dark:border-dark-outline/30"
  >
    <header class="flex shrink-0 items-start justify-between gap-4 border-b border-outline/30 p-5 dark:border-dark-outline/30">
      <div class="flex items-start gap-3">
        <div
          class="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-container-high text-primary-600 dark:bg-dark-surface-container-high dark:text-dark-primary"
          aria-hidden="true"
        >
          <span class="material-symbols-outlined text-[22px]" aria-hidden="true">person</span>
        </div>
        <div>
          <h2 class="font-headline text-lg font-bold text-on-surface dark:text-dark-on-surface">
            Informações do contato
          </h2>
          <p v-if="contato" class="mt-0.5 text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
            Detalhes da conversa
          </p>
        </div>
      </div>

      <button
        type="button"
        class="rounded-xl p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface dark:text-dark-on-surface-variant dark:hover:bg-dark-surface-container-high dark:hover:text-dark-on-surface"
        aria-label="Fechar"
        @click="fechar"
      >
        <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" />
        </svg>
      </button>
    </header>

    <div class="min-h-0 flex-1 overflow-y-auto p-5">
      <Detalhes
        v-if="contato"
        :contato="contato"
        :conversa-editavel="editavel"
        :workspace-id="workspaceId"
        @nome-salvo="emit('nomeSalvo', $event)"
      >
        <slot name="etapa-funil" />
        <slot />
      </Detalhes>

      <p v-else class="text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
        Contato não encontrado.
      </p>
    </div>

    <footer class="shrink-0 border-t border-outline/30 p-5 dark:border-dark-outline/30">
      <div class="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <div class="w-full sm:w-32">
          <BaseButton type="button" variant="secondary" @click="fechar">
            Fechar
          </BaseButton>
        </div>
      </div>
    </footer>
  </div>
</template>
