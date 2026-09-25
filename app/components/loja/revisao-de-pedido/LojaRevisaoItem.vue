<script setup lang="ts">
import { computed } from 'vue'
import type { LojaCarrinhoItem } from '#shared/types/loja'

const props = defineProps<{
  item: LojaCarrinhoItem
}>()

const subtotal = computed(() => props.item.preco_unitario * props.item.quantidade)

function formatPreco(valor: number): string {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}
</script>

<template>
  <article class="flex gap-3 py-4">
    <div class="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-surface-container dark:bg-dark-surface-container">
      <img
        v-if="item.imagem_url"
        :src="item.imagem_url"
        :alt="item.nome"
        class="h-full w-full object-cover"
      >
      <div
        v-else
        class="flex h-full w-full items-center justify-center text-[10px] text-on-surface-variant dark:text-dark-on-surface-variant"
      >
        Sem foto
      </div>
    </div>

    <div class="min-w-0 flex-1">
      <h2 class="text-[15px] font-semibold leading-snug text-on-surface dark:text-dark-on-surface">
        {{ item.nome }}
      </h2>
      <p
        v-if="item.observacao"
        class="mt-0.5 line-clamp-2 text-xs text-on-surface-variant dark:text-dark-on-surface-variant"
      >
        {{ item.observacao }}
      </p>
      <p class="mt-2 text-[15px] font-semibold text-on-surface dark:text-dark-on-surface">
        {{ formatPreco(subtotal) }}
      </p>
      <p class="text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
        ({{ item.quantidade }} × {{ formatPreco(item.preco_unitario) }})
      </p>
    </div>
  </article>
</template>
