<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ProdutoWorkspaceItem, ProdutosBuscaResponse } from '#shared/types/produtos'
import { useWorkspacesStore } from '~/stores/workspaces'
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

const workspaces = useWorkspacesStore()

const workspaceId = computed<number | null>(() => {
  const raw = workspaces.currentWorkspaceId
  const n = raw != null && raw !== '' ? Number.parseInt(String(raw), 10) : Number.NaN
  return Number.isFinite(n) && n > 0 ? n : null
})

const termoBusca = ref('')
const resultados = ref<ProdutoWorkspaceItem[]>([])
const buscando = ref(false)
const erroBusca = ref<string | null>(null)
const buscou = ref(false)

function parseMoedaPtBr(value: string): number {
  const numero = Number.parseFloat(value.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(numero) ? numero : 0
}

function formatarMoeda(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatarPrecoUnitario(value: number): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function subtotalProduto(produto: ProdutoCobrancaItem): number {
  return produto.quantidade * parseMoedaPtBr(produto.precoUnitario)
}

const total = computed(() =>
  produtos.value.reduce((acc, produto) => acc + subtotalProduto(produto), 0),
)

const totalFormatado = computed(() => formatarMoeda(total.value))

async function pesquisarProdutos() {
  const termo = termoBusca.value.trim()
  const wid = workspaceId.value
  if (wid == null) {
    erroBusca.value = 'Workspace não identificado.'
    return
  }

  buscando.value = true
  erroBusca.value = null
  buscou.value = true
  try {
    const resposta = await $fetch<ProdutosBuscaResponse>('/api/produtos/buscar', {
      method: 'GET',
      query: {
        workspace_id: wid,
        page: 1,
        page_size: 20,
        ...(termo ? { q: termo } : {}),
      },
    })
    resultados.value = resposta.data ?? []
  } catch {
    resultados.value = []
    erroBusca.value = 'Não foi possível buscar produtos.'
  } finally {
    buscando.value = false
  }
}

function selecionarProduto(produto: ProdutoWorkspaceItem) {
  const proximoId = Math.max(0, ...produtos.value.map((item) => item.id)) + 1
  produtos.value = [
    ...produtos.value,
    {
      id: proximoId,
      produtoId: produto.id,
      nome: produto.nome,
      unidadeVenda: produto.unidade_venda?.trim() || 'un',
      quantidade: 1,
      precoUnitario: formatarPrecoUnitario(produto.preco ?? 0),
    },
  ]
  resultados.value = []
  termoBusca.value = ''
  buscou.value = false
}

function atualizarProduto(
  id: number,
  campo: 'quantidade' | 'precoUnitario',
  valor: string | number,
) {
  produtos.value = produtos.value.map((produto) =>
    produto.id === id ? { ...produto, [campo]: valor } : produto,
  )
}

function removerProduto(id: number) {
  produtos.value = produtos.value.filter((produto) => produto.id !== id)
}

const inputClass =
  'w-full rounded-lg border border-outline/40 bg-surface-container-lowest px-3 py-2.5 font-body text-sm text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary-100 dark:border-dark-outline/40 dark:bg-dark-surface-container-low dark:text-dark-on-surface dark:focus:border-dark-primary dark:focus:ring-dark-primary/20'
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
        Busque o produto pelo nome e selecione para adicionar à cobrança. O total é calculado automaticamente.
      </p>
    </header>

    <div class="space-y-2">
      <label class="font-label text-sm font-medium text-on-surface dark:text-dark-on-surface">
        Buscar produto
      </label>
      <div class="flex gap-2">
        <input
          v-model="termoBusca"
          type="text"
          placeholder="Digite o nome do produto e pressione Enter"
          :class="inputClass"
          @keyup.enter="pesquisarProdutos"
        >
        <button
          type="button"
          class="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 font-label text-sm font-semibold text-on-primary shadow-sm transition hover:bg-primary-700 disabled:opacity-60 dark:bg-primary-600 dark:hover:bg-primary-700"
          :disabled="buscando"
          @click="pesquisarProdutos"
        >
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" stroke-linecap="round" />
          </svg>
          <span class="hidden sm:inline">Buscar</span>
        </button>
      </div>

      <p v-if="buscando" class="font-body text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
        Buscando produtos...
      </p>
      <p v-else-if="erroBusca" class="font-body text-sm text-danger dark:text-dark-danger">
        {{ erroBusca }}
      </p>
      <p
        v-else-if="buscou && resultados.length === 0"
        class="font-body text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
      >
        Nenhum produto encontrado para este termo.
      </p>

      <ul
        v-if="resultados.length > 0"
        class="max-h-72 space-y-2 overflow-y-auto rounded-2xl border border-outline/30 p-2 dark:border-dark-outline/30"
      >
        <li v-for="produto in resultados" :key="produto.id">
          <button
            type="button"
            class="flex w-full items-center justify-between gap-3 rounded-xl border border-transparent bg-surface-container-lowest p-3 text-left transition hover:bg-surface-container-low dark:bg-dark-surface-container-low dark:hover:bg-dark-surface-container"
            @click="selecionarProduto(produto)"
          >
            <span class="min-w-0 flex-1">
              <span class="block truncate font-label text-sm font-semibold text-on-surface dark:text-dark-on-surface">
                {{ produto.nome }}
              </span>
              <span class="mt-0.5 block truncate font-body text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
                Unidade: {{ produto.unidade_venda || 'un' }}
              </span>
            </span>
            <span class="shrink-0 font-label text-sm font-semibold text-primary dark:text-dark-primary">
              {{ formatarMoeda(produto.preco ?? 0) }}
            </span>
          </button>
        </li>
      </ul>
    </div>

    <div v-if="produtos.length > 0" class="space-y-3">
      <h3 class="font-label text-sm font-semibold text-on-surface dark:text-dark-on-surface">
        Itens selecionados
      </h3>
      <ItemProdutoLinha
        v-for="produto in produtos"
        :key="produto.id"
        :nome="produto.nome"
        :unidade-venda="produto.unidadeVenda"
        :quantidade="produto.quantidade"
        :preco-unitario="produto.precoUnitario"
        :subtotal="formatarMoeda(subtotalProduto(produto))"
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
        Nenhum produto adicionado. Busque e selecione um item acima.
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
          Soma dos itens selecionados.
        </p>
      </div>
      <strong class="font-headline text-2xl font-bold text-primary dark:text-dark-primary">
        {{ totalFormatado }}
      </strong>
    </div>
  </section>
</template>
