<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useLojaWorkspaceStore } from '~/stores/loja/workspace'

const loja = useLojaWorkspaceStore()
const { paginaProdutoUnico } = storeToRefs(loja)

const precoExibir = computed(() => {
  const p = paginaProdutoUnico.value
  if (!p) return null
  if (p.preco_promocional != null && Number.isFinite(p.preco_promocional)) return p.preco_promocional
  return p.preco
})

function formatPreco(valor: number): string {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}
</script>

<template>
  <section v-if="paginaProdutoUnico" class="px-4 py-5">
    <h2 class="text-xl font-bold tracking-tight text-on-surface dark:text-dark-on-surface">
      {{ paginaProdutoUnico.nome }}
    </h2>
    <p
      v-if="precoExibir != null"
      class="mt-2 text-lg font-semibold text-on-surface dark:text-dark-on-surface"
    >
      {{ formatPreco(precoExibir) }}
    </p>
    <p
      v-if="paginaProdutoUnico.descricao"
      class="mt-3 text-sm leading-relaxed text-on-surface-variant dark:text-dark-on-surface-variant"
    >
      {{ paginaProdutoUnico.descricao }}
    </p>
  </section>
</template>
