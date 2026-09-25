<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import type { LojaFormaPagamento } from '#shared/types/loja'
import { useLojaWorkspaceStore } from '~/stores/loja/workspace'

const ROTULOS: Record<LojaFormaPagamento, string> = {
  pix: 'PIX',
  boleto: 'Boleto',
  credito_online: 'Cartão de crédito (online)',
  debito_online: 'Cartão de débito (online)',
  dinheiro: 'Dinheiro na entrega',
  credito_entrega: 'Cartão de crédito na entrega',
  debito: 'Cartão de débito na entrega',
  vale_refeicao: 'Vale refeição',
}

const loja = useLojaWorkspaceStore()
const { formaPagamento } = storeToRefs(loja)

const rotulo = computed(() => {
  const forma = formaPagamento.value
  if (!forma) return 'Não selecionada'
  return ROTULOS[forma]
})
</script>

<template>
  <section class="px-4 pt-5">
    <h2 class="text-sm font-semibold text-on-surface dark:text-dark-on-surface">
      Pagamento
    </h2>
    <p class="mt-2 rounded-2xl border border-outline/30 px-4 py-3 text-sm text-on-surface dark:border-dark-outline/30 dark:text-dark-on-surface">
      {{ rotulo }}
    </p>
  </section>
</template>
