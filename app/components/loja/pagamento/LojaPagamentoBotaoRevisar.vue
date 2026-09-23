<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useLojaWorkspaceStore } from '~/stores/loja/workspace'

const loja = useLojaWorkspaceStore()
const { formaPagamento } = storeToRefs(loja)

const podeRevisar = computed(() => formaPagamento.value != null)
</script>

<template>
  <div
    class="pointer-events-none sticky bottom-0 z-30 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] pt-4"
  >
    <button
      type="button"
      class="pointer-events-auto mx-auto flex h-14 w-full max-w-lg items-center justify-center rounded-full px-5 text-base font-semibold shadow-lg md:max-w-2xl"
      :class="
        podeRevisar
          ? 'bg-[#00C853] text-white'
          : 'bg-surface-container text-on-surface-variant dark:bg-dark-surface-container dark:text-dark-on-surface-variant'
      "
      :disabled="!podeRevisar"
    >
      Revisar pedido
    </button>
  </div>
</template>
