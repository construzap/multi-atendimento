<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import RelatoriosCard from '~/components/relatorios/RelatoriosCard.vue'
import { useRelatoriosStore } from '~/stores/relatorios'

defineProps<{ delay?: number }>()

const relatorios = useRelatoriosStore()
const { ticketMedio, totalPedidos } = storeToRefs(relatorios)

const formatado = computed(() =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(ticketMedio.value),
)
</script>

<template>
  <RelatoriosCard destaque :delay="delay">
    <p class="font-body text-xs font-semibold uppercase tracking-wider text-primary-700 dark:text-primary-400">
      Ticket médio
    </p>
    <p class="mt-2 font-headline text-3xl font-bold tracking-tight text-on-surface transition-transform duration-300 group-hover:scale-[1.02] dark:text-dark-on-surface md:text-4xl">
      {{ formatado }}
    </p>
    <p class="mt-2 font-body text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
      Média por pedido ({{ totalPedidos }})
    </p>
  </RelatoriosCard>
</template>
