<script setup lang="ts">
import { computed } from 'vue'
import ItemProdutoLinha from './ItemProdutoLinha.vue'

type ProdutoCobrancaItem = {
  id: number
  produtoId: number | null
  nome: string
  unidadeVenda: string
  quantidade: number
  precoUnitario: string
}

const produtos = defineModel<ProdutoCobrancaItem[]>('produtos', { required: true })

function parseMoedaPtBr(value: string): number {
  const numero = Number.parseFloat(value.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(numero) ? numero : 0
}

function formatarMoeda(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function subtotalProduto(produto: ProdutoCobrancaItem): number {
  return produto.quantidade * parseMoedaPtBr(produto.precoUnitario)
}

const total = computed(() =>
  produtos.value.reduce((acc, produto) => acc + subtotalProduto(produto), 0),
)

const totalFormatado = computed(() => formatarMoeda(total.value))

function adicionarProduto() {
  const proximoId = Math.max(0, ...produtos.value.map((item) => item.id), 0) + 1
  produtos.value = [
    ...produtos.value,
    {
      id: proximoId,
      produtoId: null,
      nome: '',
      unidadeVenda: '',
      quantidade: 1,
      precoUnitario: '0,00',
    },
  ]
}

function atualizarProduto(
  id: number,
  campo: 'nome' | 'quantidade' | 'precoUnitario',
  valor: string | number,
) {
  produtos.value = produtos.value.map((produto) =>
    produto.id === id ? { ...produto, [campo]: valor } : produto,
  )
}

function removerProduto(id: number) {
  produtos.value = produtos.value.filter((produto) => produto.id !== id)
}
</script>

<template>
  <section class="space-y-6">
    <header class="space-y-2">
      <p class="font-label text-sm font-semibold uppercase tracking-wide text-primary dark:text-dark-primary">
        Passo 2
      </p>
      <h2 class="font-headline text-2xl font-bold tracking-tight text-on-surface dark:text-dark-on-surface">
        O que está sendo comprado?
      </h2>
      <p class="max-w-2xl font-body text-sm leading-relaxed text-on-surface-variant dark:text-dark-on-surface-variant">
        Adicione os produtos manualmente com nome, quantidade e preço unitário. O total é calculado automaticamente.
      </p>
    </header>

    <div class="flex justify-end">
      <button
        type="button"
        class="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 font-label text-sm font-semibold text-on-primary shadow-sm transition hover:bg-primary-700 dark:bg-primary-600 dark:hover:bg-primary-700"
        @click="adicionarProduto"
      >
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M12 5v14M5 12h14" stroke-linecap="round" />
        </svg>
        Adicionar produto
      </button>
    </div>

    <div v-if="produtos.length > 0" class="space-y-3">
      <ItemProdutoLinha
        v-for="produto in produtos"
        :key="produto.id"
        :nome="produto.nome"
        :quantidade="produto.quantidade"
        :preco-unitario="produto.precoUnitario"
        :subtotal="formatarMoeda(subtotalProduto(produto))"
        @update:nome="atualizarProduto(produto.id, 'nome', $event)"
        @update:quantidade="atualizarProduto(produto.id, 'quantidade', $event)"
        @update:preco-unitario="atualizarProduto(produto.id, 'precoUnitario', $event)"
        @remover="removerProduto(produto.id)"
      />
    </div>

    <div
      v-else
      class="rounded-2xl border border-dashed border-outline/40 px-5 py-8 text-center dark:border-dark-outline/40"
    >
      <p class="font-body text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
        Nenhum produto adicionado. Clique em “Adicionar produto” para começar.
      </p>
    </div>

    <div
      class="flex flex-col gap-2 rounded-2xl border border-primary/30 bg-primary-50/70 p-5 dark:border-dark-primary/40 dark:bg-dark-primary-container/30 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <p class="font-label text-sm font-semibold text-on-surface dark:text-dark-on-surface">
          Valor total da cobrança
        </p>
        <p class="font-body text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
          Soma dos itens adicionados.
        </p>
      </div>
      <strong class="font-headline text-2xl font-bold text-primary dark:text-dark-primary">
        {{ totalFormatado }}
      </strong>
    </div>
  </section>
</template>
