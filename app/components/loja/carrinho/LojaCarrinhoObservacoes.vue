<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useLojaWorkspaceStore } from '~/stores/loja/workspace'

const loja = useLojaWorkspaceStore()
const { observacaoPedido } = storeToRefs(loja)

function onInput(event: Event) {
  const el = event.target as HTMLInputElement
  loja.setObservacaoPedido(el.value)
}
</script>

<template>
  <section class="px-4 pb-4">
    <input
      :value="observacaoPedido"
      type="text"
      maxlength="280"
      placeholder="Observações sobre o pedido"
      class="w-full rounded-2xl border border-outline/35 bg-transparent px-4 py-3.5 text-sm text-on-surface outline-none placeholder:text-on-surface-variant focus:border-outline dark:border-dark-outline/35 dark:text-dark-on-surface dark:placeholder:text-dark-on-surface-variant"
      @input="onInput"
    >
  </section>
</template>
