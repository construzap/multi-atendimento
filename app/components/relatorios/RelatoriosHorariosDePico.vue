<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import RelatoriosCard from '~/components/relatorios/RelatoriosCard.vue'
import { useRelatoriosStore } from '~/stores/relatorios'

defineProps<{ delay?: number }>()

const relatorios = useRelatoriosStore()
const { horariosDePico } = storeToRefs(relatorios)

const maxQtd = computed(() =>
  Math.max(1, ...horariosDePico.value.map((h) => h.quantidade)),
)
</script>

<template>
  <RelatoriosCard :delay="delay">
    <h3 class="mb-4 font-headline text-base font-semibold text-on-surface dark:text-dark-on-surface">
      Horários de pico
    </h3>

    <p
      v-if="horariosDePico.length === 0"
      class="font-body text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
    >
      Nenhum pedido no período.
    </p>

    <ul v-else class="space-y-2">
      <li
        v-for="item in horariosDePico"
        :key="item.hora"
        class="rounded-xl px-2.5 py-2 transition-colors duration-200 hover:bg-primary-50/80 dark:hover:bg-primary-500/10"
      >
        <div class="mb-1.5 flex items-center justify-between gap-3">
          <span class="font-body text-sm text-on-surface dark:text-dark-on-surface">
            {{ item.label }}
          </span>
          <span class="font-headline text-sm font-semibold tabular-nums text-on-surface dark:text-dark-on-surface">
            {{ item.quantidade }}
          </span>
        </div>
        <div class="h-1.5 overflow-hidden rounded-full bg-surface-container dark:bg-dark-surface-container-high">
          <div
            class="h-full rounded-full bg-primary-500 transition-all duration-500 ease-out dark:bg-primary-400"
            :style="{ width: `${(item.quantidade / maxQtd) * 100}%` }"
          />
        </div>
      </li>
    </ul>
  </RelatoriosCard>
</template>
