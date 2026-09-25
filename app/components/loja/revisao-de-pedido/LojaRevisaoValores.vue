<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useLojaWorkspaceStore } from '~/stores/loja/workspace'

const loja = useLojaWorkspaceStore()
const { carrinhoTotal, modoRecebimento } = storeToRefs(loja)

function formatPreco(valor: number): string {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

const subtotal = computed(() => formatPreco(carrinhoTotal.value))
const eEntrega = computed(() => modoRecebimento.value === 'entrega')
</script>

<template>
  <section class="px-4 py-5">
    <div class="flex items-center justify-between py-1.5 text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
      <span>Subtotal</span>
      <span>{{ subtotal }}</span>
    </div>
    <div
      v-if="eEntrega"
      class="flex items-center justify-between py-1.5 text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
    >
      <span>Taxa de entrega</span>
      <span>(a ser calculado)</span>
    </div>
    <div class="flex items-center justify-between py-2 text-base font-semibold text-on-surface dark:text-dark-on-surface">
      <span>Total</span>
      <span>{{ subtotal }}</span>
    </div>
  </section>
</template>
