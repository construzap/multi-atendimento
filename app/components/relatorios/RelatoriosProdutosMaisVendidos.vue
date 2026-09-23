<script setup lang="ts">
import { storeToRefs } from 'pinia'
import RelatoriosCard from '~/components/relatorios/RelatoriosCard.vue'
import { useRelatoriosStore } from '~/stores/relatorios'

defineProps<{ delay?: number }>()

const relatorios = useRelatoriosStore()
const { produtosMaisVendidos } = storeToRefs(relatorios)
</script>

<template>
  <RelatoriosCard :delay="delay">
    <h3 class="mb-4 font-headline text-base font-semibold text-on-surface dark:text-dark-on-surface">
      Produtos mais vendidos
    </h3>

    <p
      v-if="produtosMaisVendidos.length === 0"
      class="font-body text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
    >
      Nenhum produto no período.
    </p>

    <ul v-else class="space-y-1">
      <li
        v-for="(item, idx) in produtosMaisVendidos"
        :key="item.nome"
        class="flex items-center justify-between gap-3 rounded-xl px-2.5 py-2.5 transition-colors duration-200 hover:bg-primary-50/80 dark:hover:bg-primary-500/10"
      >
        <div class="flex min-w-0 items-center gap-2.5">
          <span
            class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700 transition-transform duration-200 group-hover:scale-105 dark:bg-primary-500/20 dark:text-primary-300"
          >
            {{ idx + 1 }}
          </span>
          <span class="truncate font-body text-sm text-on-surface dark:text-dark-on-surface">
            {{ item.nome }}
          </span>
        </div>
        <span class="shrink-0 font-headline text-lg font-semibold tabular-nums text-on-surface dark:text-dark-on-surface">
          {{ item.quantidade }}
        </span>
      </li>
    </ul>
  </RelatoriosCard>
</template>
