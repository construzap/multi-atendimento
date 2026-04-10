<script setup lang="ts">
import BaseDropdown from '~/components/ui/BaseDropdown.vue'

const emit = defineEmits<{
  editar: []
  excluir: []
}>()

function onEditar(close: () => void) {
  close()
  emit('editar')
}

function onExcluir(close: () => void) {
  close()
  emit('excluir')
}
</script>

<template>
  <BaseDropdown
    title="Configurações"
    align="right"
    panel-class="w-52 min-w-[12rem] max-w-[calc(100vw-2rem)]"
  >
    <template #trigger>
      <span
        class="flex h-10 w-10 items-center justify-center rounded-lg transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        <span
          class="material-symbols-outlined text-2xl text-on-surface-variant dark:text-slate-400"
          aria-hidden="true"
        >
          settings
        </span>
        <span class="sr-only">Configurações do canal</span>
      </span>
    </template>

    <template #default="{ close }">
      <button
        type="button"
        role="menuitem"
        class="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-high dark:text-dark-on-surface dark:hover:bg-dark-surface-container-high"
        @click="onEditar(close)"
      >
        <span class="material-symbols-outlined text-[20px] text-on-surface-variant dark:text-dark-on-surface-variant" aria-hidden="true">
          edit
        </span>
        Editar
      </button>
      <button
        type="button"
        role="menuitem"
        class="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
        @click="onExcluir(close)"
      >
        <span class="material-symbols-outlined text-[20px]" aria-hidden="true">
          delete
        </span>
        Excluir
      </button>
    </template>
  </BaseDropdown>
</template>
