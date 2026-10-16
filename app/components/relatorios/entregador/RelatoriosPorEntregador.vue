<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import RelatoriosCard from '~/components/relatorios/RelatoriosCard.vue'
import RelatoriosEntregadorModal from '~/components/relatorios/entregador/RelatoriosEntregadorModal.vue'
import { useRelatoriosStore } from '~/stores/relatorios'

defineProps<{ delay?: number }>()

const relatorios = useRelatoriosStore()
const { porEntregador } = storeToRefs(relatorios)

const aberto = ref(false)
const entregadorSelecionado = ref<string | null>(null)

function formatarMoeda(valor: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor)
}

function abrir(label: string) {
  entregadorSelecionado.value = label
  aberto.value = true
}

function fechar() {
  aberto.value = false
}
</script>

<template>
  <RelatoriosCard :delay="delay">
    <h3 class="mb-4 font-headline text-base font-semibold text-on-surface dark:text-dark-on-surface">
      Por entregador
    </h3>

    <p
      v-if="porEntregador.length === 0"
      class="font-body text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
    >
      Nenhum pedido no período.
    </p>

    <ul v-else class="space-y-1">
      <li v-for="item in porEntregador" :key="item.label">
        <button
          type="button"
          class="flex w-full items-center justify-between gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors duration-200 hover:bg-primary-50/80 dark:hover:bg-primary-500/10"
          @click="abrir(item.label)"
        >
          <div class="min-w-0">
            <p class="truncate font-body text-sm font-medium text-on-surface dark:text-dark-on-surface">
              {{ item.label }}
            </p>
            <p class="font-body text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
              {{ item.quantidade }} pedido{{ item.quantidade === 1 ? '' : 's' }}
            </p>
          </div>
          <span class="shrink-0 font-headline text-lg font-semibold tabular-nums text-on-surface dark:text-dark-on-surface">
            {{ formatarMoeda(item.valor) }}
          </span>
        </button>
      </li>
    </ul>

    <RelatoriosEntregadorModal
      v-model:open="aberto"
      :entregador="entregadorSelecionado"
      @close="fechar"
    />
  </RelatoriosCard>
</template>
