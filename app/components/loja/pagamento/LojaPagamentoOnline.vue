<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import LojaPagamentoOpcao from '~/components/loja/pagamento/LojaPagamentoOpcao.vue'
import { useLojaWorkspaceStore } from '~/stores/loja/workspace'

const loja = useLojaWorkspaceStore()
const { formaPagamento, canal } = storeToRefs(loja)
const ativas = computed(() => canal.value?.formas_pagamento.online ?? [])
</script>

<template>
  <section v-if="ativas.length" class="px-4 pt-6">
    <p class="mb-3 flex items-center gap-2 text-sm text-[#00C853]">
      <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
        <rect x="7" y="2" width="10" height="20" rx="2" />
        <path d="M11 18h2" stroke-linecap="round" />
      </svg>
      Pagar online
    </p>
    <div class="flex flex-col gap-3">
      <LojaPagamentoOpcao
        v-if="ativas.includes('pix')"
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
        v-if="ativas.includes('boleto')"
        titulo="Boleto"
        :selecionado="formaPagamento === 'boleto'"
        @selecionar="loja.setFormaPagamento('boleto')"
      >
        <template #icon>
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <rect x="4" y="5" width="16" height="14" rx="2" />
            <path d="M7 9h10M7 12h6" stroke-linecap="round" />
          </svg>
        </template>
      </LojaPagamentoOpcao>
      <LojaPagamentoOpcao
        v-if="ativas.includes('cartao_credito')"
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
      <LojaPagamentoOpcao
        v-if="ativas.includes('cartao_debito')"
        titulo="Cartão de débito"
        :selecionado="formaPagamento === 'debito_online'"
        @selecionar="loja.setFormaPagamento('debito_online')"
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
