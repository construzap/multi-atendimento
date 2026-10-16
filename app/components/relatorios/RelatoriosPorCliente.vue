<script setup lang="ts">
import { storeToRefs } from 'pinia'
import RelatoriosCard from '~/components/relatorios/RelatoriosCard.vue'
import { useRelatoriosStore } from '~/stores/relatorios'

defineProps<{ delay?: number }>()

const relatorios = useRelatoriosStore()
const { porCliente } = storeToRefs(relatorios)

function nomeCliente(name: string | null, phone: string | null) {
  return name?.trim() || phone?.trim() || 'Cliente sem nome'
}

function inicial(name: string | null, phone: string | null) {
  const base = nomeCliente(name, phone)
  return base.charAt(0).toUpperCase()
}
</script>

<template>
  <RelatoriosCard :delay="delay">
    <div class="mb-4 flex items-baseline justify-between gap-3">
      <h3 class="font-headline text-base font-semibold text-on-surface dark:text-dark-on-surface">
        Por cliente
      </h3>
      <span class="font-body text-xs tabular-nums text-on-surface-variant dark:text-dark-on-surface-variant">
        {{ porCliente.length }} cliente{{ porCliente.length === 1 ? '' : 's' }}
      </span>
    </div>

    <p
      v-if="porCliente.length === 0"
      class="font-body text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
    >
      Nenhum pedido no período.
    </p>

    <ul v-else class="space-y-1">
      <li
        v-for="item in porCliente"
        :key="item.conversa_key"
        class="flex items-center justify-between gap-3 rounded-xl px-2.5 py-2.5 transition-colors duration-200 hover:bg-primary-50/80 dark:hover:bg-primary-500/10"
      >
        <div class="flex min-w-0 items-center gap-3">
          <img
            v-if="item.photo"
            :src="item.photo"
            alt=""
            class="h-9 w-9 shrink-0 rounded-full object-cover"
          />
          <span
            v-else
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700 dark:bg-primary-500/20 dark:text-primary-300"
          >
            {{ inicial(item.name, item.phone) }}
          </span>
          <div class="min-w-0">
            <p class="truncate font-body text-sm font-medium text-on-surface dark:text-dark-on-surface">
              {{ nomeCliente(item.name, item.phone) }}
            </p>
            <p
              v-if="item.name && item.phone"
              class="truncate font-body text-xs text-on-surface-variant dark:text-dark-on-surface-variant"
            >
              {{ item.phone }}
            </p>
          </div>
        </div>
        <span class="shrink-0 font-headline text-lg font-semibold tabular-nums text-on-surface dark:text-dark-on-surface">
          {{ item.quantidade }}
        </span>
      </li>
    </ul>
  </RelatoriosCard>
</template>
