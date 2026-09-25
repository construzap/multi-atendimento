<script setup lang="ts">
import { storeToRefs } from 'pinia'
import LojaRevisaoItem from '~/components/loja/revisao-de-pedido/LojaRevisaoItem.vue'
import { useLojaWorkspaceStore } from '~/stores/loja/workspace'

const loja = useLojaWorkspaceStore()
const { carrinhoAtual } = storeToRefs(loja)
</script>

<template>
  <section class="px-4">
    <h2 class="pt-5 text-sm font-semibold text-on-surface dark:text-dark-on-surface">
      Itens
    </h2>
    <p
      v-if="!carrinhoAtual.length"
      class="py-8 text-center text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
    >
      Sua sacola está vazia.
    </p>
    <LojaRevisaoItem
      v-for="item in carrinhoAtual"
      :key="item.chave"
      :item="item"
    />
  </section>
</template>
