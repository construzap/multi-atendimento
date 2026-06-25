<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import ProdutosBarraAcoes from '~/components/produtos/ProdutosBarraAcoes.vue'
import ProdutosBuscaInput from '~/components/produtos/ProdutosBuscaInput.vue'
import FerramentaImportarProduto from '~/components/produtos/FerramentaImportarProduto.vue'
import ProdutosModalCriarProdutosEmMassa from '~/components/produtos/ProdutosModalCriarProdutosEmMassa.vue'
import ProdutosTabela from '~/components/produtos/ProdutosTabela.vue'

definePageMeta({
  layout: 'workspace',
})

const route = useRoute()
const produtosStore = useProdutosStore()

const { listPending, listError, page, totalPages, total } = storeToRefs(produtosStore)

function parsePositiveInt(raw: unknown): number | null {
  const s = String(Array.isArray(raw) ? raw[0] : raw ?? '').trim()
  if (!s) return null
  const n = Number.parseInt(s, 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return null
  if (String(n) !== s) return null
  return n
}

const workspaceId = computed(() => parsePositiveInt(route.params.id))

const modalCriarEmMassaAberto = ref(false)

/** Seletor de ficheiro + modal de mapeamento (`FerramentaImportarProduto`). */
const ferramentaImportarProdutoRef = ref<{ abrirSeletorImportacao: () => void } | null>(null)
const produtosTabelaRef = ref<{ resetarEstadoPosImportacao: () => void } | null>(null)

function aoClicarImportar() {
  ferramentaImportarProdutoRef.value?.abrirSeletorImportacao()
}

/** Texto no campo (edição); a listagem usa `termoPesquisa` após Enter ou «Pesquisar». */
const busca = ref('')
/** Último termo enviado ao `GET /api/produtos/buscar` como `q`. */
const termoPesquisa = ref('')

function aoPesquisar(q: string) {
  termoPesquisa.value = q
  produtosStore.page = 1
}

async function carregarLista() {
  const wid = workspaceId.value
  if (wid == null) {
    produtosStore.reset()
    return
  }
  await produtosStore.fetchPagina(wid, {
    page: produtosStore.page,
    q: termoPesquisa.value,
  })
}

watch([workspaceId, () => produtosStore.page, termoPesquisa], () => {
  void carregarLista()
}, { immediate: true })

watch(workspaceId, (wid, prev) => {
  if (prev !== undefined && wid !== prev) {
    busca.value = ''
    termoPesquisa.value = ''
    produtosStore.page = 1
  }
})

const podeAnterior = computed(() => page.value > 1)
const podeProximo = computed(() => page.value < totalPages.value)

function paginaAnterior() {
  if (!podeAnterior.value) return
  produtosStore.page -= 1
}

function paginaProxima() {
  if (!podeProximo.value) return
  produtosStore.page += 1
}

async function aposEliminados() {
  await carregarLista()
  if (produtosStore.page > produtosStore.totalPages) {
    produtosStore.page = Math.max(1, produtosStore.totalPages)
    await carregarLista()
  }
}

async function aoProdutoNovoGravado() {
  const wid = workspaceId.value
  if (wid == null) return
  produtosStore.ultimoSnapshotKey = null
  produtosStore.page = 1
  await produtosStore.fetchPagina(wid, {
    page: 1,
    q: termoPesquisa.value,
  })
}

function onPageSizeChanged(n: number) {
  produtosStore.pageSize = n
  produtosStore.page = 1
  void carregarLista()
}

function aposImportacao() {
  produtosTabelaRef.value?.resetarEstadoPosImportacao()
}
</script>

<template>
  <div
    class="mx-auto w-full min-w-0 max-w-[1920px] space-y-8 bg-background px-4 py-8 md:px-6 dark:bg-dark-background"
  >
    <header class="space-y-1">
      <h1 class="font-headline text-2xl font-bold text-on-surface dark:text-dark-on-surface">Produtos</h1>
      <p class="font-body text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
        Busca, ações e listagem de produtos
      </p>
    </header>

    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <ProdutosBuscaInput v-model="busca" :termo-aplicado="termoPesquisa" @pesquisar="aoPesquisar" />
      <ProdutosBarraAcoes @importar="aoClicarImportar" @novo="modalCriarEmMassaAberto = true" />
    </div>

    <FerramentaImportarProduto
      ref="ferramentaImportarProdutoRef"
      :workspace-id="workspaceId"
      :termo-busca="termoPesquisa"
      @importado="aposImportacao"
    />
    <ProdutosModalCriarProdutosEmMassa
      v-model:open="modalCriarEmMassaAberto"
      @gravado="aoProdutoNovoGravado"
    />
    <ProdutosTabela
      ref="produtosTabelaRef"
      :workspace-id="workspaceId ?? undefined"
      :page-size="produtosStore.pageSize"
      :total="total"
      :pending="listPending"
      :error="listError"
      @atualizado="produtosStore.aplicarLinhaAtualizada($event)"
      @erro-salvamento="void carregarLista()"
      @eliminados="aposEliminados"
      @variacao-criada="carregarLista"
      @page-size-changed="onPageSizeChanged"
    />

    <div
      v-if="!listError && total > 0"
      class="flex flex-col items-center justify-between gap-3 border-t border-outline/20 pt-4 text-sm text-on-surface-variant dark:border-dark-outline/20 dark:text-dark-on-surface-variant sm:flex-row"
    >
      <p>
        Página {{ page }} de {{ totalPages }} — {{ total }} produto(s)
      </p>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="rounded-xl border border-outline/40 px-4 py-2 font-medium text-on-surface transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-50 dark:border-dark-outline/40 dark:text-dark-on-surface dark:hover:bg-dark-surface-container-high"
          :disabled="!podeAnterior || listPending"
          @click="paginaAnterior"
        >
          Anterior
        </button>
        <button
          type="button"
          class="rounded-xl border border-outline/40 px-4 py-2 font-medium text-on-surface transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-50 dark:border-dark-outline/40 dark:text-dark-on-surface dark:hover:bg-dark-surface-container-high"
          :disabled="!podeProximo || listPending"
          @click="paginaProxima"
        >
          Próxima
        </button>
      </div>
    </div>
  </div>
</template>
