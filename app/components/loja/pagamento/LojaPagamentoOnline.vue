<script setup lang="ts">
import { storeToRefs } from 'pinia'
import LojaPagamentoOpcao from '~/components/loja/pagamento/LojaPagamentoOpcao.vue'
import { useLojaWorkspaceStore } from '~/stores/loja/workspace'

const loja = useLojaWorkspaceStore()
const { formaPagamento } = storeToRefs(loja)
</script>

<template>
  <section class="px-4 pt-6">
    <p class="mb-3 flex items-center gap-2 text-sm text-[#00C853]">
      <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
        <rect x="7" y="2" width="10" height="20" rx="2" />
        <path d="M11 18h2" stroke-linecap="round" />
      </svg>
      Pagar online
    </p>
    <div class="flex flex-col gap-3">
      <LojaPagamentoOpcao
        titulo="PIX"
        :selecionado="formaPagamento === 'pix'"
        @selecionar="loja.setFormaPagamento('pix')"
      >
        <template #icon>
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <rect x="7" y="2" width="10" height="20" rx="2" />
          </svg>
        </template>
      </LojaPagamentoOpcao>
      <LojaPagamentoOpcao
        titulo="Cartão de crédito"
        :selecionado="formaPagamento === 'credito_online'"
        @selecionar="loja.setFormaPagamento('credito_online')"
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
