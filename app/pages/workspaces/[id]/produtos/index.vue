<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import type { ProdutoTermoPesquisaItem } from '#shared/types/produtos'
import BaseButton from '~/components/BaseButton.vue'
import ProdutosBarraAcoes from '~/components/produtos/ProdutosBarraAcoes.vue'
import ProdutosBuscaInput from '~/components/produtos/ProdutosBuscaInput.vue'
import AlertaOportunidadesDeVendas from '~/components/produtos/oportunidades-de-vendas/AlertaOportunidadesDeVendas.vue'
import FerramentaImportarProduto from '~/components/produtos/FerramentaImportarProduto.vue'
import ProdutosListaTermosPesquisa from '~/components/produtos/ProdutosListaTermosPesquisa.vue'
import ProdutosModalEditarProduto from '~/components/produtos/ProdutosModalEditarProduto.vue'
import ProdutosTabela from '~/components/produtos/ProdutosTabela.vue'
import { useProdutosStore, PRODUTOS_PAGE_SIZE_TODOS, produtosTermoBucketKey } from '~/stores/produtos'
import { useProdutoTermosPesquisaStore } from '~/stores/produtoTermosPesquisa'
import { useWorkspacesStore } from '~/stores/workspaces'

definePageMeta({
  layout: 'workspace',
})

const route = useRoute()
const produtosStore = useProdutosStore()
const workspacesStore = useWorkspacesStore()
const termosStore = useProdutoTermosPesquisaStore()

const { listPending, listError, page, totalPages, total, pageSize } = storeToRefs(produtosStore)
const { items: workspaces, currentWorkspaceId } = storeToRefs(workspacesStore)

function parsePositiveInt(raw: unknown): number | null {
  const s = String(Array.isArray(raw) ? raw[0] : raw ?? '').trim()
  if (!s) return null
  const n = Number.parseInt(s, 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return null
  if (String(n) !== s) return null
  return n
}

/**
 * Preferência: `currentWorkspaceId` no Pinia; fallback na URL
 * (abertura direta / hard refresh).
 */
const workspaceId = computed(() => {
  const fromPinia = parsePositiveInt(currentWorkspaceId.value)
  if (fromPinia != null) return fromPinia
  return parsePositiveInt(route.params.id)
})

/** Limite do plano/workspace. `null` = sem limite configurado. */
const limiteProdutos = computed(() => {
  const wid = workspaceId.value
  if (wid == null) return null
  const ws = workspaces.value.find((w) => w.id === wid)
  const lim = ws?.limite_produtos
  if (lim == null || !Number.isFinite(lim) || lim < 0) return null
  return Math.trunc(lim)
})

/** Termo ativo na coluna da direita. */
const termoAtivo = ref<ProdutoTermoPesquisaItem | null>(null)
const termoAtivoId = computed(() => termoAtivo.value?.id ?? null)

const bootstrapPending = ref(true)
const bootstrapError = ref<string | null>(null)

const modalNovoProdutoAberto = ref(false)

/** Seletor de ficheiro + modal de mapeamento (`FerramentaImportarProduto`). */
const ferramentaImportarProdutoRef = ref<{ abrirSeletorImportacao: () => void } | null>(null)
const produtosTabelaRef = ref<{ resetarEstadoPosImportacao: () => void } | null>(null)

function aoClicarImportar() {
  ferramentaImportarProdutoRef.value?.abrirSeletorImportacao()
}

function aoClicarNovo() {
  if (termoAtivo.value == null) return
  modalNovoProdutoAberto.value = true
}

const termosIniciaisNovo = computed((): ProdutoTermoPesquisaItem[] =>
  termoAtivo.value ? [{ ...termoAtivo.value }] : [],
)

/** Texto no campo (edição); a listagem usa `termoPesquisa` após Enter ou «Pesquisar». */
const busca = ref('')
/** Último termo enviado ao `GET /api/produtos/buscar` como `q`. */
const termoPesquisa = ref('')

function aoPesquisar(q: string) {
  termoPesquisa.value = q
  produtosStore.page = 1
}

function qDoBucket(wid: number, termoId: number): string {
  return produtosStore.byKey[produtosTermoBucketKey(wid, termoId)]?.q ?? ''
}

function pageDoBucket(wid: number, termoId: number): number {
  return produtosStore.byKey[produtosTermoBucketKey(wid, termoId)]?.page ?? 1
}

/** Termo a restaurar a partir do cache de produtos (activeKey / keyOrder). */
function termoDoCacheProdutos(
  wid: number,
  termos: ProdutoTermoPesquisaItem[],
): ProdutoTermoPesquisaItem | null {
  const ativoId = produtosStore.activeTermoId
  if (ativoId != null) {
    const t = termos.find((x) => x.id === ativoId)
    if (t) return { ...t }
  }
  for (let i = produtosStore.keyOrder.length - 1; i >= 0; i--) {
    const key = produtosStore.keyOrder[i]!
    const bucket = produtosStore.byKey[key]
    if (!bucket || bucket.workspaceId !== wid) continue
    const t = termos.find((x) => x.id === bucket.termoId)
    if (t) return { ...t }
  }
  return null
}

function aplicarTermoAtivo(termo: ProdutoTermoPesquisaItem, wid: number) {
  const mesmo = termoAtivo.value?.id === termo.id
  termoAtivo.value = { ...termo }
  const qCache = qDoBucket(wid, termo.id)
  busca.value = qCache
  termoPesquisa.value = qCache
  produtosStore.page = pageDoBucket(wid, termo.id)
  if (mesmo) return
}

function aoSelecionarTermo(termo: ProdutoTermoPesquisaItem | null) {
  if (!termo) {
    termoAtivo.value = null
    busca.value = ''
    termoPesquisa.value = ''
    produtosStore.limparVistaLista()
    return
  }
  const wid = workspaceId.value
  if (wid == null) {
    termoAtivo.value = { ...termo }
    return
  }
  aplicarTermoAtivo(termo, wid)
}

/**
 * Abertura direta pela URL / hard refresh:
 * 1) sincroniza workspace (currentWorkspaceId ou rota)
 * 2) termos: usa Pinia se já tiver; senão GET
 * 3) produtos do termo: usa byKey se já tiver; senão GET
 */
async function bootstrapPagina() {
  bootstrapPending.value = true
  bootstrapError.value = null

  try {
    const routeId = parsePositiveInt(route.params.id)
    if (routeId != null) {
      workspacesStore.setCurrentWorkspaceId(String(routeId))
    }

    if (workspacesStore.items.length === 0 || workspacesStore.loadedAt == null) {
      await workspacesStore.ensureAllLoaded()
    }

    const wid = workspaceId.value
    if (wid == null) {
      termoAtivo.value = null
      produtosStore.limparVistaLista()
      return
    }

    await termosStore.carregarListaCompletaSeNecessario(wid)
    const termos = termosStore.getListaCompletaCopia(wid)

    if (!termos.length) {
      termoAtivo.value = null
      produtosStore.limparVistaLista()
      return
    }

    const restaurado = termoDoCacheProdutos(wid, termos)
    const escolhido = restaurado ?? { ...termos[0]! }
    aplicarTermoAtivo(escolhido, wid)

    await produtosStore.fetchPagina(wid, {
      page: produtosStore.page,
      q: termoPesquisa.value,
      termoId: escolhido.id,
    })
  } catch (err) {
    bootstrapError.value =
      err instanceof Error && err.message
        ? err.message
        : 'Não foi possível carregar a página de produtos.'
  } finally {
    bootstrapPending.value = false
  }
}

async function carregarLista(opts?: { force?: boolean }) {
  if (bootstrapPending.value) return
  const wid = workspaceId.value
  const tid = termoAtivoId.value
  if (wid == null || tid == null) {
    produtosStore.limparVistaLista()
    return
  }
  await produtosStore.fetchPagina(wid, {
    page: produtosStore.page,
    q: termoPesquisa.value,
    termoId: tid,
    force: opts?.force === true,
  })
}

onMounted(() => {
  void bootstrapPagina()
})

watch([() => produtosStore.page, termoPesquisa], () => {
  if (bootstrapPending.value) return
  void carregarLista()
})

watch(termoAtivoId, (tid, prev) => {
  if (bootstrapPending.value) return
  if (tid == null || tid === prev) return
  void carregarLista()
})

watch(workspaceId, (wid, prev) => {
  if (prev !== undefined && wid !== prev) {
    termoAtivo.value = null
    busca.value = ''
    termoPesquisa.value = ''
    produtosStore.reset()
    void bootstrapPagina()
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
  const wid = workspaceId.value
  const tid = termoAtivoId.value
  if (wid != null && tid != null) {
    produtosStore.invalidarCacheTermo(wid, tid)
  }
  await carregarLista({ force: true })
  if (produtosStore.page > produtosStore.totalPages) {
    produtosStore.page = Math.max(1, produtosStore.totalPages)
    await carregarLista({ force: true })
  }
}

async function aoProdutoNovoGravado() {
  const wid = workspaceId.value
  const tid = termoAtivoId.value
  if (wid == null || tid == null) return
  produtosStore.invalidarCacheTermo(wid, tid)
  produtosStore.page = 1
  await produtosStore.fetchPagina(wid, {
    page: 1,
    q: termoPesquisa.value,
    termoId: tid,
    force: true,
  })
  await workspacesStore.ensureAllLoaded({ force: true })
}

/** Após cadastrar via oportunidades de vendas e fechar o modal: refresca workspace + lista/total. */
async function aposOportunidadesSincronizar() {
  const wid = workspaceId.value
  const tid = termoAtivoId.value
  await workspacesStore.ensureAllLoaded({ force: true })
  if (wid == null || tid == null) return
  produtosStore.invalidarCacheTermo(wid, tid)
  await produtosStore.fetchPagina(wid, {
    page: produtosStore.page,
    q: termoPesquisa.value,
    termoId: tid,
    force: true,
  })
}

const exibindoTodos = computed(() => pageSize.value === PRODUTOS_PAGE_SIZE_TODOS)

function onPageSizeChanged(n: number) {
  const wid = workspaceId.value
  const tid = termoAtivoId.value
  produtosStore.pageSize = n
  produtosStore.page = 1
  if (wid != null && tid != null) {
    produtosStore.invalidarCacheTermo(wid, tid)
  }
  void carregarLista({ force: true })
}

function aposImportacao() {
  produtosTabelaRef.value?.resetarEstadoPosImportacao()
}
</script>

<template>
  <div
    class="mx-auto flex h-full min-h-0 w-full max-w-[1920px] flex-col gap-3 overflow-hidden bg-transparent px-4 py-4 md:gap-4 md:px-6 md:py-5"
  >
    <header class="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h1 class="font-headline text-2xl font-bold text-on-surface dark:text-dark-on-surface">
        Produtos
      </h1>
      <ProdutosBarraAcoes
        class="!justify-start sm:!justify-end"
        ocultar-novo
        @importar="aoClicarImportar"
      />
    </header>

    <div class="shrink-0">
      <AlertaOportunidadesDeVendas
        :workspace-id="workspaceId"
        @sincronizar="void aposOportunidadesSincronizar()"
      />
    </div>

    <FerramentaImportarProduto
      ref="ferramentaImportarProdutoRef"
      :workspace-id="workspaceId"
      :termo-busca="termoPesquisa"
      :termo-id="termoAtivoId"
      @importado="aposImportacao"
    />
    <ProdutosModalEditarProduto
      v-model:open="modalNovoProdutoAberto"
      :workspace-id="workspaceId"
      :row="null"
      :termos-iniciais="termosIniciaisNovo"
      @gravado="aoProdutoNovoGravado"
    />

    <div
      class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-outline/30 bg-surface dark:border-dark-outline/30 dark:bg-dark-surface lg:flex-row"
    >
      <!-- Coluna esquerda: termos -->
      <aside
        class="flex max-lg:h-[min(34vh,15rem)] w-full shrink-0 flex-col overflow-hidden border-b border-outline/30 dark:border-dark-outline/30 sm:max-lg:h-[min(36vh,16rem)] lg:w-72 lg:border-b-0 lg:border-r xl:w-80"
      >
        <ProdutosListaTermosPesquisa
          class="h-full min-h-0"
          :workspace-id="workspaceId"
          :selected-id="termoAtivoId"
          @selecionar="aoSelecionarTermo"
        />
      </aside>

      <!-- Coluna direita: produtos do termo -->
      <section class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div
          v-if="bootstrapPending"
          class="flex flex-1 items-center justify-center px-6 py-12 text-center text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
        >
          A carregar produtos…
        </div>

        <div
          v-else-if="bootstrapError"
          class="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center"
          role="alert"
        >
          <p class="text-sm text-error dark:text-dark-error">{{ bootstrapError }}</p>
          <BaseButton variant="secondary" :block="false" size="sm" type="button" @click="void bootstrapPagina()">
            Tentar de novo
          </BaseButton>
        </div>

        <template v-else-if="termoAtivo">
          <div
            class="flex shrink-0 flex-col gap-3 border-b border-outline/25 px-4 py-3 dark:border-dark-outline/25 sm:flex-row sm:items-center sm:justify-between"
          >
            <h2 class="min-w-0 truncate font-headline text-xl font-bold text-on-surface dark:text-dark-on-surface">
              {{ termoAtivo.nome }}
            </h2>
            <BaseButton
              variant="primary"
              :block="false"
              size="md"
              type="button"
              @click="aoClicarNovo"
            >
              <span class="inline-flex items-center gap-2">
                <span
                  class="material-symbols-outlined text-[20px]"
                  style="font-variation-settings: 'FILL' 1"
                  aria-hidden="true"
                >
                  add_circle
                </span>
                Adicionar item
              </span>
            </BaseButton>
          </div>

          <div class="shrink-0 px-4 py-3">
            <ProdutosBuscaInput
              v-model="busca"
              :termo-aplicado="termoPesquisa"
              @pesquisar="aoPesquisar"
            />
          </div>

          <div class="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-3">
            <ProdutosTabela
              ref="produtosTabelaRef"
              class="min-h-0 flex-1"
              :workspace-id="workspaceId ?? undefined"
              :page-size="produtosStore.pageSize"
              :total="total"
              :limite-produtos="limiteProdutos"
              :pending="listPending"
              :error="listError"
              :termo-id="termoAtivoId"
              :permitir-reordenar="!termoPesquisa.trim()"
              @atualizado="produtosStore.aplicarLinhaAtualizada($event)"
              @erro-salvamento="void carregarLista()"
              @eliminados="aposEliminados"
              @variacao-criada="carregarLista"
              @page-size-changed="onPageSizeChanged"
            />

            <div
              v-if="!listError && total > 0 && !exibindoTodos"
              class="mt-3 flex shrink-0 flex-col items-center justify-between gap-3 border-t border-outline/20 pt-3 text-sm text-on-surface-variant dark:border-dark-outline/20 dark:text-dark-on-surface-variant sm:flex-row"
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

        <div
          v-else
          class="flex flex-1 items-center justify-center px-6 py-12 text-center text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
        >
          Selecione uma categoria à esquerda para ver os produtos.
        </div>
      </section>
    </div>
  </div>
</template>
