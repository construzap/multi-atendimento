<script setup lang="ts">
import { storeToRefs } from 'pinia'
import RelatoriosCard from '~/components/relatorios/RelatoriosCard.vue'
import { useRelatoriosStore } from '~/stores/relatorios'

defineProps<{ delay?: number }>()

const relatorios = useRelatoriosStore()
const { valoresPorFormaPagamento } = storeToRefs(relatorios)

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
      Valores por forma de pagamento
    </h3>

    <p
      v-if="valoresPorFormaPagamento.length === 0"
      class="font-body text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
    >
      Nenhum pedido no período.
    </p>

    <ul v-else class="space-y-1">
      <li
        v-for="item in valoresPorFormaPagamento"
        :key="item.forma"
        class="flex items-center justify-between rounded-xl px-2.5 py-2.5 transition-colors duration-200 hover:bg-primary-50/80 dark:hover:bg-primary-500/10"
      >
        <span class="font-body text-sm text-on-surface dark:text-dark-on-surface">
          {{ item.forma }}
        </span>
        <span class="font-headline text-lg font-semibold tabular-nums text-on-surface dark:text-dark-on-surface">
          {{ formatarMoeda(item.valor) }}
        </span>
      </li>
    </ul>
  </RelatoriosCard>
</template>
