<script setup lang="ts">
import { computed } from 'vue'
import type { LojaCarrinhoItem } from '#shared/types/loja'
import { useLojaWorkspaceStore } from '~/stores/loja/workspace'

const props = defineProps<{
  item: LojaCarrinhoItem
}>()

const loja = useLojaWorkspaceStore()

const subtotal = computed(() => props.item.preco_unitario * props.item.quantidade)

function formatPreco(valor: number): string {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function menos() {
  loja.alterarQuantidadeCarrinho(props.item.chave, props.item.quantidade - 1)
}

function mais() {
  loja.alterarQuantidadeCarrinho(props.item.chave, props.item.quantidade + 1)
}

function remover() {
  loja.removerItemCarrinho(props.item.chave)
}
</script>

<template>
  <article class="flex gap-3 py-4">
    <div class="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-surface-container dark:bg-dark-surface-container">
      <img
        v-if="item.imagem_url"
        :src="item.imagem_url"
        :alt="item.nome"
        class="h-full w-full object-cover"
      >
      <div
        v-else
        class="flex h-full w-full items-center justify-center text-[10px] text-on-surface-variant dark:text-dark-on-surface-variant"
      >
        Sem foto
      </div>
    </div>

    <div class="min-w-0 flex-1">
      <div class="flex items-start justify-between gap-2">
        <h2 class="text-[15px] font-semibold leading-snug text-on-surface dark:text-dark-on-surface">
          {{ item.nome }}
        </h2>
        <button
          type="button"
          class="flex h-7 w-7 shrink-0 items-center justify-center text-on-surface-variant dark:text-dark-on-surface-variant"
          aria-label="Remover item"
          @click="remover"
        >
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 6l12 12M18 6L6 18" stroke-linecap="round" />
          </svg>
        </button>
      </div>

      <p
        v-if="item.observacao"
        class="mt-0.5 line-clamp-2 text-xs text-on-surface-variant dark:text-dark-on-surface-variant"
      >
        {{ item.observacao }}
      </p>

      <div class="mt-2 flex items-end justify-between gap-3">
        <div>
          <p class="text-[15px] font-semibold text-on-surface dark:text-dark-on-surface">
            {{ formatPreco(subtotal) }}
          </p>
          <p class="text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
            ({{ item.quantidade }} × {{ formatPreco(item.preco_unitario) }})
          </p>
        </div>

        <div class="flex items-center gap-3 text-on-surface dark:text-dark-on-surface">
          <button
            type="button"
            class="flex h-8 w-8 items-center justify-center text-lg"
            aria-label="Diminuir quantidade"
            @click="menos"
          >
            −
          </button>
          <span class="min-w-4 text-center text-sm font-medium">{{ item.quantidade }}</span>
          <button
            type="button"
            class="flex h-8 w-8 items-center justify-center text-lg"
            aria-label="Aumentar quantidade"
            @click="mais"
          >
            +
          </button>
        </div>
      </div>
    </div>
  </article>
</template>
