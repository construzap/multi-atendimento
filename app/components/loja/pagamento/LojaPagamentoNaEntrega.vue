<script setup lang="ts">
import { storeToRefs } from 'pinia'
import LojaPagamentoOpcao from '~/components/loja/pagamento/LojaPagamentoOpcao.vue'
import { useLojaWorkspaceStore } from '~/stores/loja/workspace'

const loja = useLojaWorkspaceStore()
const { formaPagamento } = storeToRefs(loja)
</script>

<template>
  <section class="px-4 pt-6">
    <p class="mb-3 flex items-center gap-2 text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
      <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
        <path d="M4 10l8-6 8 6v9a1 1 0 01-1 1h-5v-6H10v6H5a1 1 0 01-1-1v-9z" stroke-linejoin="round" />
      </svg>
      Pagar na entrega
    </p>
    <div class="flex flex-col gap-3">
      <LojaPagamentoOpcao
        titulo="Dinheiro"
        :selecionado="formaPagamento === 'dinheiro'"
        @selecionar="loja.setFormaPagamento('dinheiro')"
      >
        <template #icon>
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <rect x="3" y="6" width="18" height="12" rx="2" />
            <circle cx="12" cy="12" r="2.2" />
          </svg>
        </template>
      </LojaPagamentoOpcao>
      <LojaPagamentoOpcao
        titulo="Cartão de crédito"
        :selecionado="formaPagamento === 'credito_entrega'"
        @selecionar="loja.setFormaPagamento('credito_entrega')"
      >
        <template #icon>
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <rect x="2" y="6" width="20" height="13" rx="2" />
            <path d="M2 10h20" />
          </svg>
        </template>
      </LojaPagamentoOpcao>
      <LojaPagamentoOpcao
        titulo="Cartão de débito"
        :selecionado="formaPagamento === 'debito'"
        @selecionar="loja.setFormaPagamento('debito')"
      >
        <template #icon>
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <rect x="2" y="6" width="20" height="13" rx="2" />
            <path d="M2 10h20" />
          </svg>
        </template>
      </LojaPagamentoOpcao>
      <LojaPagamentoOpcao
        titulo="Vale refeição"
        detalhe="Taxa adicional de 2%"
        :selecionado="formaPagamento === 'vale_refeicao'"
        @selecionar="loja.setFormaPagamento('vale_refeicao')"
      >
        <template #icon>
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <rect x="2" y="6" width="20" height="13" rx="2" />
            <path d="M2 10h20" />
          </svg>
        </template>
      </LojaPagamentoOpcao>
    </div>
  </section>
</template>
