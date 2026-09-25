<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useLojaWorkspaceStore } from '~/stores/loja/workspace'

const loja = useLojaWorkspaceStore()
const { observacaoPedido } = storeToRefs(loja)
</script>

<template>
  <section v-if="observacaoPedido.trim()" class="px-4 pt-2">
    <h2 class="text-sm font-semibold text-on-surface dark:text-dark-on-surface">
      Observações
    </h2>
    <p class="mt-2 whitespace-pre-line rounded-2xl bg-surface-container px-4 py-3 text-sm text-on-surface dark:bg-dark-surface-container dark:text-dark-on-surface">
      {{ observacaoPedido }}
    </p>
  </section>
</template>
