<script setup lang="ts">
import { computed, ref } from 'vue'
import type { KanbanNotificacaoIa } from '#shared/types/kanban'
import {
  formatMoedaBr,
  parseProdutosNotificacao,
} from './parseProdutosNotificacao'

const STORAGE_KEY = 'kanban.notificacoes_ia.imprimir_ao_aceitar'

const props = defineProps<{
  item: KanbanNotificacaoIa
  busy?: boolean
}>()

const emit = defineEmits<{
  aceitar: [payload: { imprimir: boolean }]
  rejeitar: []
}>()

const produtos = computed(() => parseProdutosNotificacao(props.item.produtos))

function lerPreferenciaImprimir(): boolean {
  if (!import.meta.client) return false
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

const imprimirAoAceitar = ref(lerPreferenciaImprimir())

function onChangeImprimir(e: Event) {
  const checked = (e.target as HTMLInputElement).checked
  imprimirAoAceitar.value = checked
  if (!import.meta.client) return
  try {
    localStorage.setItem(STORAGE_KEY, checked ? '1' : '0')
  } catch {
    /* ignore */
  }
}

function onAceitar() {
  emit('aceitar', { imprimir: imprimirAoAceitar.value === true })
}
</script>

<template>
  <div class="space-y-5">
    <p
      v-if="item.observacoes?.trim()"
      class="text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
    >
      {{ item.observacoes.trim() }}
    </p>

    <!-- Itens -->
    <div v-if="produtos.length" class="space-y-3">
      <div
        v-for="(p, idx) in produtos"
        :key="idx"
        class="grid grid-cols-[1fr_auto_auto] items-baseline gap-x-4 gap-y-0.5"
      >
        <p class="min-w-0 text-sm font-semibold text-on-surface dark:text-dark-on-surface">
          {{ p.nome }}
        </p>
        <p class="shrink-0 text-sm tabular-nums text-on-surface-variant dark:text-dark-on-surface-variant">
          <template v-if="p.qtd != null">QTD: {{ p.qtd }}</template>
          <template v-else>—</template>
        </p>
        <p class="shrink-0 text-right text-sm font-medium tabular-nums text-on-surface dark:text-dark-on-surface">
          <template v-if="p.preco != null && p.qtd != null">
            {{ formatMoedaBr(p.preco * p.qtd) }}
          </template>
          <template v-else-if="p.preco != null">
            {{ formatMoedaBr(p.preco) }}
          </template>
          <template v-else>—</template>
        </p>
      </div>
    </div>
    <p
      v-else
      class="text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
    >
      Nenhum produto listado.
    </p>

    <!-- Total + pagamento -->
    <div class="space-y-2 border-t border-outline/30 pt-4 dark:border-dark-outline/30">
      <div class="flex items-baseline justify-between gap-4">
        <span class="text-sm font-bold uppercase tracking-wide text-on-surface dark:text-dark-on-surface">
          Total
        </span>
        <span class="text-base font-bold tabular-nums text-on-surface dark:text-dark-on-surface">
          {{ formatMoedaBr(item.total_orcamento) }}
        </span>
      </div>
      <div class="flex items-baseline justify-between gap-4">
        <span class="text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
          Forma de pagamento
        </span>
        <span class="text-sm font-medium text-on-surface dark:text-dark-on-surface">
          {{ item.forma_pagamento?.trim() || '—' }}
        </span>
      </div>
    </div>

    <label
      class="inline-flex cursor-pointer items-center gap-2.5 select-none"
      :class="busy ? 'pointer-events-none opacity-60' : ''"
    >
      <input
        type="checkbox"
        class="h-4 w-4 rounded border-outline/50 text-primary-600 focus:ring-primary-500/30 dark:border-dark-outline/50"
        :checked="imprimirAoAceitar"
        :disabled="busy"
        @change="onChangeImprimir"
      />
      <span class="text-sm text-on-surface dark:text-dark-on-surface">
        Imprimir pedido ao aceitar
      </span>
    </label>

    <!-- Ações -->
    <div class="flex flex-wrap items-center justify-end gap-2 pt-1">
      <button
        type="button"
        class="rounded-xl px-4 py-2.5 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface disabled:opacity-60 dark:text-dark-on-surface-variant dark:hover:bg-dark-surface-container-high dark:hover:text-dark-on-surface"
        :disabled="busy"
        @click="emit('rejeitar')"
      >
        Rejeitar
      </button>
      <button
        type="button"
        class="rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 disabled:opacity-60 dark:bg-primary-500 dark:hover:bg-primary-600"
        :disabled="busy || item.concluido === true"
        @click="onAceitar"
      >
        {{ item.concluido ? 'Aceito' : 'Aceitar' }}
      </button>
    </div>
  </div>
</template>
