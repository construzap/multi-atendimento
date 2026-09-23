<script setup lang="ts">
import { storeToRefs } from 'pinia'
import RelatoriosCard from '~/components/relatorios/RelatoriosCard.vue'
import { useRelatoriosStore } from '~/stores/relatorios'

defineProps<{ delay?: number }>()

const relatorios = useRelatoriosStore()
const { pagosVsPendentes } = storeToRefs(relatorios)

function formatarMoeda(valor: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor)
}
</script>

<template>
  <RelatoriosCard :delay="delay">
    <h3 class="mb-4 font-headline text-base font-semibold text-on-surface dark:text-dark-on-surface">
      Pagos vs pendentes
    </h3>

    <ul class="space-y-1">
      <li
        v-for="item in pagosVsPendentes"
        :key="item.label"
        class="flex items-center justify-between gap-3 rounded-xl px-2.5 py-2.5 transition-colors duration-200 hover:bg-primary-50/80 dark:hover:bg-primary-500/10"
      >
        <div class="min-w-0">
          <p class="font-body text-sm font-medium text-on-surface dark:text-dark-on-surface">
            {{ item.label }}
          </p>
          <p class="font-body text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
            {{ item.quantidade }} pedido{{ item.quantidade === 1 ? '' : 's' }}
          </p>
        </div>
        <span class="font-headline text-lg font-semibold tabular-nums text-on-surface dark:text-dark-on-surface">
          {{ formatarMoeda(item.valor) }}
        </span>
      </li>
    </ul>
  </RelatoriosCard>
</template>
