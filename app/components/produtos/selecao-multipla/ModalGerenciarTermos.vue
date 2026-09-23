<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import type {
  ProdutoTermoPesquisaDetalhado,
  ProdutoTermoPesquisaItem,
  ProdutoAtualizarResponse,
  ProdutosTermoPesquisaAtualizarResponse,
  ProdutosTermoPesquisaEliminarResponse,
} from '#shared/types/produtos'
import BaseButton from '~/components/BaseButton.vue'
import BaseInput from '~/components/BaseInput.vue'
import BaseModal from '~/components/BaseModal.vue'
import ModalAlerta from '~/components/ModalAlerta.vue'
import { CONFIG_SELECAO_MULTIPLA } from './produtosSelecaoMultiplaConfig'
import { mensagemErroFetch } from '~/stores/canais'
import { useProdutoTermosPesquisaStore } from '~/stores/produtoTermosPesquisa'

const open = defineModel<boolean>('open', { default: false })

const props = withDefaults(
  defineProps<{
    workspaceId?: number | null
    /**
     * Ao abrir o modal: dispara edição ou eliminação desse termo
     * (após carregar a lista detalhada). `null` = só listar.
     */
    acaoInicial?: 'editar' | 'eliminar' | null
    termoIdInicial?: number | null
    /** Ajuda a achar o termo na listagem detalhada (filtro `q`). */
    termoNomeInicial?: string | null
  }>(),
  {
    workspaceId: null,
    acaoInicial: null,
    termoIdInicial: null,
    termoNomeInicial: null,
  },
)

const config = CONFIG_SELECAO_MULTIPLA
const store = useProdutoTermosPesquisaStore()
const { todos_termos, todosTermosPending, todosTermosHasMore, todosTermosQ } = storeToRefs(store)

const filtroBusca = ref('')
const expandidoId = ref<number | null>(null)
const erroInicial = ref(false)

const modalEdicaoAberto = ref(false)
const termoEmEdicao = ref<ProdutoTermoPesquisaDetalhado | null>(null)
const nomeEdicao = ref('')
const guardandoEdicao = ref(false)

const alertaEliminarAberto = ref(false)
const alertaPerguntarTransferirAberto = ref(false)
const termoAEliminar = ref<ProdutoTermoPesquisaDetalhado | null>(null)
const eliminandoId = ref<number | null>(null)

const alertaTransferirAberto = ref(false)
const filtroTransferencia = ref('')
const termoDestino = ref<ProdutoTermoPesquisaItem | null>(null)
const carregandoDestinos = ref(false)

const alertaConfirmarTransferenciaAberto = ref(false)
const transferindo = ref(false)

const listaScrollRef = ref<HTMLElement | null>(null)
const sentinelRef = ref<HTMLElement | null>(null)
let scrollObserver: IntersectionObserver | null = null

let debounceBusca: ReturnType<typeof setTimeout> | null = null

const iconEditarClass =
  'inline-flex shrink-0 items-center justify-center self-center rounded-lg bg-sky-500/20 p-1.5 text-sky-700 transition-colors hover:bg-sky-500/35 hover:text-sky-900 disabled:pointer-events-none disabled:opacity-40 dark:bg-sky-500/25 dark:text-sky-200 dark:hover:bg-sky-500/45 dark:hover:text-white'
const iconEliminarClass =
  'inline-flex shrink-0 items-center justify-center self-center rounded-lg bg-red-500/20 p-1.5 text-red-700 transition-colors hover:bg-red-500/35 hover:text-red-900 disabled:pointer-events-none disabled:opacity-40 dark:bg-red-500/25 dark:text-red-200 dark:hover:bg-red-500/45 dark:hover:text-white'

const subtitulo = computed(() => {
  const n = todos_termos.value.length
  const q = todosTermosQ.value
  if (todosTermosPending.value && n === 0) return 'A carregar categorias…'
  if (n === 0) {
    return q
      ? `Nenhuma categoria encontrada para «${q}».`
      : 'Nenhuma categoria cadastrada neste workspace.'
  }
  if (todosTermosHasMore.value) {
    return q
      ? `${n} resultado${n === 1 ? '' : 's'} para «${q}» — há mais na lista.`
      : `${n} categorias carregadas — há mais na lista.`
  }
  return q
    ? `${n} resultado${n === 1 ? '' : 's'} para «${q}».`
    : `${n} categoria${n === 1 ? '' : 's'} no workspace.`
})

const textoAlertaEliminar = computed(() => {
  const item = termoAEliminar.value
  if (!item) return ''
  return config.labelEliminarConfirm(item.nome)
})

const textoAlertaPerguntarTransferir = computed(() => {
  const item = termoAEliminar.value
  if (!item) return ''
  const n = item.total_usos
  return `A categoria «${item.nome}» está em ${n} produto${n === 1 ? '' : 's'} ativo${n === 1 ? '' : 's'}. Deseja transferir esses produtos para outra categoria antes de eliminar?`
})

const textoAlertaTransferir = computed(() => {
  const item = termoAEliminar.value
  if (!item) return ''
  const n = item.produtos?.length ?? 0
  return `Selecione a categoria de destino para transferir ${n} produto${n === 1 ? '' : 's'} vinculado${n === 1 ? '' : 's'} a «${item.nome}».`
})

const textoConfirmarTransferencia = computed(() => {
  const origem = termoAEliminar.value
  const destino = termoDestino.value
  if (!origem || !destino) return ''
  const n = origem.produtos?.length ?? 0
  return `Transferir ${n} produto${n === 1 ? '' : 's'} de «${origem.nome}» para «${destino.nome}» e eliminar a categoria de origem?`
})

const destinosTransferencia = computed(() => {
  const wid = props.workspaceId
  const origemId = termoAEliminar.value?.id
  if (wid == null || wid < 1 || origemId == null) return []
  const lista = store.getListaCompletaCopia(wid).filter((t) => t.id !== origemId)
  const q = filtroTransferencia.value.trim().toLowerCase()
  if (!q) return lista.slice(0, 40)
  return lista.filter((t) => t.nome.toLowerCase().includes(q)).slice(0, 40)
})

async function carregarLista(q?: string) {
  const wid = props.workspaceId
  if (wid == null || wid < 1) {
    toast.error('Workspace inválido.')
    return
  }
  erroInicial.value = false
  expandidoId.value = null
  try {
    await store.carregarTodosTermos(wid, {
      append: false,
      q: q ?? filtroBusca.value,
    })
  } catch (err) {
    erroInicial.value = true
    toast.error(mensagemErroFetch(err, 'Não foi possível carregar as categorias.'))
  }
}

async function carregarMais() {
  if (!todosTermosHasMore.value || todosTermosPending.value) return
  try {
    await store.carregarMaisTodosTermos()
  } catch (err) {
    toast.error(mensagemErroFetch(err, 'Não foi possível carregar mais categorias.'))
  }
}

function desligarScrollInfinito() {
  scrollObserver?.disconnect()
  scrollObserver = null
}

async function ligarScrollInfinito() {
  desligarScrollInfinito()
  await nextTick()
  const root = listaScrollRef.value
  const target = sentinelRef.value
  if (!root || !target || !open.value) return

  scrollObserver = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return
      void carregarMais()
    },
    { root, rootMargin: '120px', threshold: 0 },
  )
  scrollObserver.observe(target)
}

function agendarBusca() {
  if (debounceBusca) clearTimeout(debounceBusca)
  debounceBusca = setTimeout(() => {
    debounceBusca = null
    void carregarLista(filtroBusca.value)
  }, 280)
}

watch(filtroBusca, () => {
  if (!open.value) return
  agendarBusca()
})

watch(
  [() => open.value, () => todos_termos.value.length, todosTermosHasMore, todosTermosPending],
  () => {
    if (!open.value || todos_termos.value.length === 0 || !todosTermosHasMore.value) {
      desligarScrollInfinito()
      return
    }
    if (todosTermosPending.value) return
    void ligarScrollInfinito()
  },
)

function toggleExpandido(id: number) {
  expandidoId.value = expandidoId.value === id ? null : id
}

function iniciarEdicao(termo: ProdutoTermoPesquisaDetalhado) {
  termoEmEdicao.value = { ...termo }
  nomeEdicao.value = termo.nome
  modalEdicaoAberto.value = true
}

function cancelarEdicao() {
  if (guardandoEdicao.value) return
  modalEdicaoAberto.value = false
  termoEmEdicao.value = null
  nomeEdicao.value = ''
}

async function confirmarEdicao() {
  const wid = props.workspaceId
  const itemId = termoEmEdicao.value?.id
  if (wid == null || wid < 1 || itemId == null) return
  const nome = nomeEdicao.value.trim()
  if (!nome) {
    toast.error(config.erroNomeVazio)
    return
  }
  guardandoEdicao.value = true
  try {
    const res = await $fetch<ProdutosTermoPesquisaAtualizarResponse>(config.apiItem(itemId), {
      method: 'PATCH',
      body: { workspace_id: wid, nome },
    })
    store.substituirTermo(wid, res.data)
    store.atualizarNomeTodosTermos(itemId, res.data.nome)
    cancelarEdicao()
    toast.success(config.toastAtualizado)
  } catch (err) {
    toast.error(mensagemErroFetch(err, config.erroAtualizar))
  } finally {
    guardandoEdicao.value = false
  }
}

function pedirEliminar(termo: ProdutoTermoPesquisaDetalhado) {
  limparFluxoTransferencia()
  termoAEliminar.value = { ...termo, produtos: [...(termo.produtos ?? [])] }
  alertaEliminarAberto.value = true
}

/** Localiza o termo (paginando se preciso) e abre edição ou eliminação. */
async function aplicarAcaoInicial() {
  const acao = props.acaoInicial
  const id = props.termoIdInicial
  if (!acao || id == null || id < 1) return

  async function localizarTermo(): Promise<ProdutoTermoPesquisaDetalhado | null> {
    let termo = todos_termos.value.find((t) => t.id === id) ?? null
    let guard = 0
    while (!termo && todosTermosHasMore.value && guard < 50) {
      guard++
      try {
        await store.carregarMaisTodosTermos()
      } catch {
        break
      }
      termo = todos_termos.value.find((t) => t.id === id) ?? null
    }
    return termo
  }

  let termo = await localizarTermo()
  if (!termo && filtroBusca.value.trim()) {
    filtroBusca.value = ''
    await carregarLista('')
    termo = await localizarTermo()
  }

  if (!termo) {
    toast.error('Não foi possível localizar a categoria para esta ação.')
    return
  }

  expandidoId.value = termo.id
  await nextTick()
  if (acao === 'editar') iniciarEdicao(termo)
  else pedirEliminar(termo)
}

function limparFluxoTransferencia() {
  alertaPerguntarTransferirAberto.value = false
  alertaTransferirAberto.value = false
  alertaConfirmarTransferenciaAberto.value = false
  filtroTransferencia.value = ''
  termoDestino.value = null
  carregandoDestinos.value = false
  transferindo.value = false
}

function cancelarEliminar() {
  if (eliminandoId.value != null || transferindo.value) return
  alertaEliminarAberto.value = false
  limparFluxoTransferencia()
  termoAEliminar.value = null
}

async function executarDelete(item: ProdutoTermoPesquisaDetalhado) {
  const wid = props.workspaceId
  if (wid == null || wid < 1) return
  eliminandoId.value = item.id
  try {
    await $fetch<ProdutosTermoPesquisaEliminarResponse>(config.apiItem(item.id), {
      method: 'DELETE',
      query: { workspace_id: wid },
    })
    store.removerTermo(wid, item.id)
    store.removerTodosTermos(item.id)
    if (expandidoId.value === item.id) expandidoId.value = null
    if (termoEmEdicao.value?.id === item.id) cancelarEdicao()
    alertaEliminarAberto.value = false
    limparFluxoTransferencia()
    termoAEliminar.value = null
    toast.success(config.toastEliminado)
  } catch (err) {
    toast.error(mensagemErroFetch(err, config.erroEliminar))
  } finally {
    eliminandoId.value = null
  }
}

async function abrirTransferencia() {
  const wid = props.workspaceId
  const item = termoAEliminar.value
  if (wid == null || wid < 1 || !item) return

  carregandoDestinos.value = true
  try {
    await store.carregarListaCompletaSeNecessario(wid)
    const destinos = store.getListaCompletaCopia(wid).filter((t) => t.id !== item.id)
    if (!destinos.length) {
      toast.error('Não há outra categoria para transferir. Crie uma categoria nova antes de eliminar esta.')
      return
    }
    alertaPerguntarTransferirAberto.value = false
    alertaEliminarAberto.value = false
    filtroTransferencia.value = ''
    termoDestino.value = null
    alertaTransferirAberto.value = true
  } catch (err) {
    toast.error(mensagemErroFetch(err, 'Não foi possível carregar as categorias de destino.'))
  } finally {
    carregandoDestinos.value = false
  }
}

/** Confirma o primeiro alerta de eliminar. */
async function confirmarEliminar() {
  const item = termoAEliminar.value
  if (!item) return

  if (item.em_uso) {
    alertaEliminarAberto.value = false
    alertaPerguntarTransferirAberto.value = true
    return
  }

  await executarDelete(item)
}

/** Em uso: usuário escolheu transferir / atualizar produtos. */
async function confirmarQuerTransferir() {
  await abrirTransferencia()
}

/** Em uso: usuário não quer atualizar — só elimina o termo. */
async function confirmarEliminarSemTransferir() {
  const item = termoAEliminar.value
  if (!item) return
  alertaPerguntarTransferirAberto.value = false
  await executarDelete(item)
}

function cancelarPerguntarTransferir() {
  if (eliminandoId.value != null || transferindo.value || carregandoDestinos.value) return
  // "Não" = eliminar sem transferir
  void confirmarEliminarSemTransferir()
}

function cancelarTransferencia() {
  if (transferindo.value) return
  alertaTransferirAberto.value = false
  filtroTransferencia.value = ''
  termoDestino.value = null
  termoAEliminar.value = null
}

function escolherDestino(item: ProdutoTermoPesquisaItem) {
  termoDestino.value = { ...item }
}

function continuarTransferencia() {
  if (!termoDestino.value || !termoAEliminar.value) {
    toast.error('Selecione uma categoria de destino.')
    return
  }
  alertaTransferirAberto.value = false
  alertaConfirmarTransferenciaAberto.value = true
}

function cancelarConfirmarTransferencia() {
  if (transferindo.value) return
  alertaConfirmarTransferenciaAberto.value = false
  alertaTransferirAberto.value = true
}

async function confirmarTransferenciaEEliminar() {
  const wid = props.workspaceId
  const origem = termoAEliminar.value
  const destino = termoDestino.value
  if (wid == null || wid < 1 || !origem || !destino) return

  const produtoIds = [...new Set((origem.produtos ?? []).map((p) => p.id).filter((id) => id > 0))]
  if (!produtoIds.length) {
    alertaConfirmarTransferenciaAberto.value = false
    await executarDelete(origem)
    return
  }

  transferindo.value = true
  eliminandoId.value = origem.id
  try {
    // Adiciona o termo destino em cada produto órfão via PATCH /atualizar.
    for (const produtoId of produtoIds) {
      await $fetch<ProdutoAtualizarResponse>('/api/produtos/atualizar', {
        method: 'PATCH',
        body: {
          workspace_id: wid,
          id: produtoId,
          patch: {
            termos_pesquisa_ids: [destino.id],
          },
        },
      })
    }

    await $fetch<ProdutosTermoPesquisaEliminarResponse>(config.apiItem(origem.id), {
      method: 'DELETE',
      query: { workspace_id: wid },
    })

    store.removerTermo(wid, origem.id)
    store.aposTransferirTodosTermos(origem.id, destino.id, origem.produtos ?? [])
    if (expandidoId.value === origem.id) expandidoId.value = null
    if (termoEmEdicao.value?.id === origem.id) cancelarEdicao()

    alertaConfirmarTransferenciaAberto.value = false
    limparFluxoTransferencia()
    termoAEliminar.value = null
    toast.success(`Produtos transferidos para «${destino.nome}» e categoria eliminada.`)
  } catch (err) {
    toast.error(mensagemErroFetch(err, 'Não foi possível transferir e eliminar a categoria.'))
  } finally {
    transferindo.value = false
    eliminandoId.value = null
  }
}

function fechar() {
  open.value = false
}

watch(
  () => open.value,
  async (isOpen) => {
    if (isOpen) {
      const nomeFoco = (props.termoNomeInicial ?? '').trim()
      filtroBusca.value = props.acaoInicial && nomeFoco ? nomeFoco : ''
      await carregarLista(filtroBusca.value)
      await aplicarAcaoInicial()
      return
    }
    if (debounceBusca) {
      clearTimeout(debounceBusca)
      debounceBusca = null
    }
    expandidoId.value = null
    filtroBusca.value = ''
    cancelarEdicao()
    cancelarEliminar()
    store.limparTodosTermos()
  },
)

onUnmounted(() => {
  if (debounceBusca) clearTimeout(debounceBusca)
  desligarScrollInfinito()
})
</script>

<template>
  <BaseModal
    v-model:open="open"
    title="Gerenciar categorias"
    panel-class="w-full max-w-2xl"
    body-class="!overflow-hidden !p-0"
    @close="fechar"
  >
    <template #subtitle>
      {{ subtitulo }}
    </template>

    <div class="flex max-h-[min(70vh,32rem)] flex-col">
      <div class="shrink-0 border-b border-outline/30 px-4 py-3 dark:border-dark-outline/30">
        <BaseInput
          id="gerenciar-termos-busca"
          v-model="filtroBusca"
          type="search"
          autocomplete="off"
          placeholder="Buscar categoria pelo nome…"
        />
      </div>

      <div
        v-if="todosTermosPending && todos_termos.length === 0"
        class="px-5 py-8 text-center text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
      >
        A carregar…
      </div>

      <div
        v-else-if="erroInicial && todos_termos.length === 0"
        class="space-y-3 px-5 py-8 text-center"
      >
        <p class="text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
          Não foi possível carregar a lista.
        </p>
        <BaseButton :block="false" variant="secondary" size="sm" @click="carregarLista()">
          Tentar de novo
        </BaseButton>
      </div>

      <div
        v-else-if="todos_termos.length === 0"
        class="px-5 py-8 text-center text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
      >
        {{
          todosTermosQ
            ? `Nenhuma categoria encontrada para «${todosTermosQ}».`
            : 'Nenhuma categoria encontrada.'
        }}
      </div>

      <ul
        v-else
        ref="listaScrollRef"
        class="min-h-0 flex-1 divide-y divide-outline/25 overflow-y-auto dark:divide-dark-outline/25"
      >
        <li
          v-for="termo in todos_termos"
          :key="termo.id"
          class="px-4 py-3 sm:px-5"
        >
          <div class="flex items-start gap-2">
            <button
              type="button"
              class="flex min-w-0 flex-1 items-start gap-3 text-left"
              @click="toggleExpandido(termo.id)"
            >
              <span
                class="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-container-high text-on-surface-variant dark:bg-dark-surface-container-high dark:text-dark-on-surface-variant"
              >
                <span class="material-symbols-outlined text-[18px]" aria-hidden="true">
                  {{ expandidoId === termo.id ? 'expand_less' : 'expand_more' }}
                </span>
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-semibold text-on-surface dark:text-dark-on-surface">
                  {{ termo.nome }}
                </span>
                <span class="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
                  <span
                    class="inline-flex items-center rounded-full px-2 py-0.5 font-medium"
                    :class="
                      termo.em_uso
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                        : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
                    "
                  >
                    {{ termo.em_uso ? 'Em uso' : 'Sem uso' }}
                  </span>
                  <span>{{ termo.total_usos }} produto{{ termo.total_usos === 1 ? '' : 's' }}</span>
                </span>
              </span>
            </button>

            <button
              type="button"
              :class="iconEditarClass"
              aria-label="Editar"
              :disabled="eliminandoId === termo.id"
              @click.stop="iniciarEdicao(termo)"
            >
              <span class="material-symbols-outlined text-[18px]" aria-hidden="true">edit</span>
            </button>
            <button
              type="button"
              :class="iconEliminarClass"
              aria-label="Eliminar"
              :disabled="eliminandoId === termo.id"
              @click.stop="pedirEliminar(termo)"
            >
              <span class="material-symbols-outlined text-[18px]" aria-hidden="true">delete</span>
            </button>
          </div>

          <ul
            v-if="expandidoId === termo.id"
            class="mt-2 space-y-1 border-l-2 border-primary-200 pl-4 dark:border-primary-800"
          >
            <li
              v-if="!termo.produtos.length"
              class="text-xs text-on-surface-variant dark:text-dark-on-surface-variant"
            >
              Nenhum produto ativo vinculado.
            </li>
            <li
              v-for="p in termo.produtos"
              :key="p.id"
              class="truncate text-xs text-on-surface dark:text-dark-on-surface"
            >
              {{ p.nome }}
              <span class="text-on-surface-variant dark:text-dark-on-surface-variant">#{{ p.id }}</span>
            </li>
          </ul>
        </li>

        <li
          v-if="todosTermosPending && todos_termos.length > 0"
          class="px-4 py-3 text-center text-xs text-on-surface-variant dark:text-dark-on-surface-variant"
        >
          A carregar…
        </li>
        <li
          v-else-if="!todosTermosHasMore"
          class="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant dark:text-dark-on-surface-variant"
        >
          FIM DA LISTA
        </li>
        <li
          v-else
          ref="sentinelRef"
          class="h-4 w-full shrink-0"
          aria-hidden="true"
        />
      </ul>
    </div>

    <template #footer>
      <BaseButton type="button" variant="secondary" :block="false" @click="fechar">
        Fechar
      </BaseButton>
    </template>
  </BaseModal>

  <BaseModal
    v-model:open="modalEdicaoAberto"
    :title="config.tituloEditar"
    panel-class="w-full max-w-md"
    :show-close="!guardandoEdicao"
    :close-on-backdrop="!guardandoEdicao"
    :close-on-escape="!guardandoEdicao"
    @close="cancelarEdicao"
  >
    <div class="space-y-4">
      <div>
        <label
          class="mb-1.5 block text-xs font-medium uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant"
        >
          {{ config.labelNomeCampo }}
        </label>
        <BaseInput
          v-model="nomeEdicao"
          autocomplete="off"
          :placeholder="config.placeholderEdicao"
          :disabled="guardandoEdicao"
          @keydown.enter.prevent="confirmarEdicao"
        />
      </div>

      <div class="flex justify-end gap-2 pt-1">
        <BaseButton
          :block="false"
          variant="secondary"
          size="sm"
          :disabled="guardandoEdicao"
          @click="cancelarEdicao"
        >
          Cancelar
        </BaseButton>
        <BaseButton
          :block="false"
          variant="primary"
          size="sm"
          :disabled="guardandoEdicao || !nomeEdicao.trim()"
          @click="confirmarEdicao"
        >
          {{ guardandoEdicao ? 'A guardar…' : 'Salvar' }}
        </BaseButton>
      </div>
    </div>
  </BaseModal>

  <ModalAlerta
    v-model:open="alertaEliminarAberto"
    :title="config.tituloEliminar"
    :texto="textoAlertaEliminar"
    variante="perigo"
    texto-confirmar="Eliminar"
    texto-cancelar="Cancelar"
    :confirmar-desabilitado="eliminandoId != null || carregandoDestinos"
    :cancelar-desabilitado="eliminandoId != null || carregandoDestinos"
    @confirmar="confirmarEliminar"
    @cancelar="cancelarEliminar"
  />

  <ModalAlerta
    v-model:open="alertaPerguntarTransferirAberto"
    title="Categoria em uso"
    :texto="textoAlertaPerguntarTransferir"
    variante="aviso"
    texto-confirmar="Sim, transferir"
    texto-cancelar="Não, só eliminar"
    :mostrar-fechar="false"
    :confirmar-desabilitado="eliminandoId != null || carregandoDestinos || transferindo"
    :cancelar-desabilitado="eliminandoId != null || carregandoDestinos || transferindo"
    @confirmar="confirmarQuerTransferir"
    @cancelar="cancelarPerguntarTransferir"
  />

  <ModalAlerta
    v-model:open="alertaTransferirAberto"
    title="Transferir produtos"
    :texto="textoAlertaTransferir"
    variante="aviso"
    texto-confirmar="Continuar"
    texto-cancelar="Cancelar"
    :confirmar-desabilitado="!termoDestino || transferindo"
    :cancelar-desabilitado="transferindo"
    @confirmar="continuarTransferencia"
    @cancelar="cancelarTransferencia"
  >
    <div class="space-y-3">
      <BaseInput
        id="transferir-termo-busca"
        v-model="filtroTransferencia"
        type="search"
        autocomplete="off"
        placeholder="Buscar categoria…"
      />
      <ul
        class="max-h-56 overflow-y-auto rounded-xl border border-outline/30 dark:border-dark-outline/30"
      >
        <li v-if="!destinosTransferencia.length" class="px-3 py-4 text-center text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
          Nenhuma categoria encontrada.
        </li>
        <li
          v-for="item in destinosTransferencia"
          :key="item.id"
          class="border-b border-outline/20 last:border-b-0 dark:border-dark-outline/20"
        >
          <button
            type="button"
            class="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors"
            :class="
              termoDestino?.id === item.id
                ? 'bg-primary-50 font-semibold text-primary-800 dark:bg-primary-900/30 dark:text-primary-200'
                : 'text-on-surface hover:bg-surface-container-high dark:text-dark-on-surface dark:hover:bg-dark-surface-container-high'
            "
            @click="escolherDestino(item)"
          >
            <span
              class="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border"
              :class="
                termoDestino?.id === item.id
                  ? 'border-primary-500 bg-primary-500 text-white'
                  : 'border-outline/50 dark:border-dark-outline/50'
              "
            >
              <span
                v-if="termoDestino?.id === item.id"
                class="material-symbols-outlined text-[12px] leading-none"
                aria-hidden="true"
              >check</span>
            </span>
            <span class="min-w-0 truncate">{{ item.nome }}</span>
          </button>
        </li>
      </ul>
    </div>
  </ModalAlerta>

  <ModalAlerta
    v-model:open="alertaConfirmarTransferenciaAberto"
    title="Confirmar transferência"
    :texto="textoConfirmarTransferencia"
    variante="perigo"
    texto-confirmar="Transferir e eliminar"
    texto-cancelar="Voltar"
    :confirmar-desabilitado="transferindo"
    :cancelar-desabilitado="transferindo"
    @confirmar="confirmarTransferenciaEEliminar"
    @cancelar="cancelarConfirmarTransferencia"
  />
</template>
