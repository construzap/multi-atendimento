<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useLojaWorkspaceStore } from '~/stores/loja/workspace'

const LIMITE = 140

const loja = useLojaWorkspaceStore()
const { paginaProdutoUnico, observacaoProdutoUnico } = storeToRefs(loja)

const restante = computed(() => observacaoProdutoUnico.value.length)
</script>

<template>
  <section v-if="paginaProdutoUnico" class="px-4 pb-6">
    <div class="flex items-center justify-between gap-3">
      <label
        for="loja-observacao"
        class="flex min-w-0 items-center gap-2 text-sm font-medium text-on-surface-variant dark:text-dark-on-surface-variant"
      >
        <svg class="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path
            d="M21 12a8.4 8.4 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.4 8.4 0 01-3.8-.9L3 21l1.4-5.7A8.4 8.4 0 013.5 11.5 8.5 8.5 0 018.2 3.9 8.4 8.4 0 0112 3h.5A8.5 8.5 0 0121 11.5V12z"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <span>Alguma observação?</span>
      </label>
      <span class="shrink-0 text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
        {{ restante }}/{{ LIMITE }}
      </span>
    </div>

    <input
      id="loja-observacao"
      v-model="observacaoProdutoUnico"
      type="text"
      :maxlength="LIMITE"
      class="mt-3 w-full rounded-2xl border border-outline/35 bg-transparent px-4 py-4 text-base text-on-surface outline-none focus:border-outline dark:border-dark-outline/35 dark:text-dark-on-surface"
    >
  </section>
</template>
