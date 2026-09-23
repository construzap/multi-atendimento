<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import type {
  ProdutoTermoPesquisaItem,
  ProdutosTermoPesquisaAtualizarResponse,
  ProdutosTermoPesquisaCriarResponse,
  ProdutosTermoPesquisaEliminarResponse,
  ProdutosTermosPesquisaReordenarResponse,
} from '#shared/types/produtos'
import BaseButton from '~/components/BaseButton.vue'
import BaseInput from '~/components/BaseInput.vue'
import BaseModal from '~/components/BaseModal.vue'
import ModalAlerta from '~/components/ModalAlerta.vue'
import { CONFIG_SELECAO_MULTIPLA } from '~/components/produtos/selecao-multipla/produtosSelecaoMultiplaConfig'
import { mensagemErroFetch } from '~/stores/canais'
import { useProdutoTermosPesquisaStore } from '~/stores/produtoTermosPesquisa'

const props = withDefaults(
  defineProps<{
    workspaceId?: number | null
    /** Termo atualmente selecionado na listagem de produtos. */
    selectedId?: number | null
  }>(),
  {
    workspaceId: null,
    selectedId: null,
  },
)

const emit = defineEmits<{
  selecionar: [termo: ProdutoTermoPesquisaItem | null]
}>()

const config = CONFIG_SELECAO_MULTIPLA
const termosStore = useProdutoTermosPesquisaStore()

const pending = ref(false)
const erro = ref<string | null>(null)
const filtro = ref('')

const modalFormAberto = ref(false)
const modoModal = ref<'criar' | 'editar'>('criar')
const nomeModal = ref('')
const termoEmEdicao = ref<ProdutoTermoPesquisaItem | null>(null)
const guardandoModal = ref(false)

const alertaEliminarAberto = ref(false)
const termoAEliminar = ref<ProdutoTermoPesquisaItem | null>(null)
const eliminandoId = ref<number | null>(null)
const reordenando = ref(false)
const dragTermoId = ref<number | null>(null)
const dragOverTermoId = ref<number | null>(null)

const iconEditarClass =
  'inline-flex shrink-0 items-center justify-center self-center rounded-lg bg-sky-500/20 p-1.5 text-sky-700 transition-colors hover:bg-sky-500/35 hover:text-sky-900 disabled:pointer-events-none disabled:opacity-40 dark:bg-sky-500/25 dark:text-sky-200 dark:hover:bg-sky-500/45 dark:hover:text-white'
const iconEliminarClass =
  'inline-flex shrink-0 items-center justify-center self-center rounded-lg bg-red-500/20 p-1.5 text-red-700 transition-colors hover:bg-red-500/35 hover:text-red-900 disabled:pointer-events-none disabled:opacity-40 dark:bg-red-500/25 dark:text-red-200 dark:hover:bg-red-500/45 dark:hover:text-white'

const tituloModal = computed(() =>
  modoModal.value === 'criar' ? config.tituloCriar : config.tituloEditar,
)

const textoAlertaEliminar = computed(() =>
  termoAEliminar.value ? config.labelEliminarConfirm(termoAEliminar.value.nome) : '',
)

const termos = computed(() => {
  const wid = props.workspaceId
  if (wid == null || wid < 1) return []
  return termosStore.getListaCompletaCopia(wid)
})

const termosFiltrados = computed(() => {
  const q = filtro.value.trim().toLowerCase()
  if (!q.length) return termos.value
  return termos.value.filter((t) => t.nome.toLowerCase().includes(q))
})

/** Reordenar só com a lista completa (sem filtro de nome). */
const podeReordenarTermos = computed(() => !filtro.value.trim().length)

function onTermoDragStart(termoId: number, ev: DragEvent) {
  if (!podeReordenarTermos.value || reordenando.value) {
    ev.preventDefault()
    return
  }
  dragTermoId.value = termoId
  ev.dataTransfer?.setData('text/plain', String(termoId))
  if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move'
}

function onTermoDragOver(termoId: number, ev: DragEvent) {
  if (!podeReordenarTermos.value || dragTermoId.value == null) return
  if (termoId === dragTermoId.value) return
  ev.preventDefault()
  if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move'
  dragOverTermoId.value = termoId
}

async function onTermoDrop(termoId: number, ev: DragEvent) {
  ev.preventDefault()
  const fromId = dragTermoId.value
  dragOverTermoId.value = null
  dragTermoId.value = null
  if (fromId == null || fromId === termoId) return
  await moverTermoPara(fromId, termoId)
}

function onTermoDragEnd() {
  dragTermoId.value = null
  dragOverTermoId.value = null
}

async function moverTermoPara(fromId: number, toId: number) {
  const wid = props.workspaceId
  if (wid == null || wid < 1 || !podeReordenarTermos.value || reordenando.value) return
  const snapshot = termosStore.getListaCompletaCopia(wid)
  const lista = snapshot.map((t) => ({ ...t }))
  const fromIndex = lista.findIndex((t) => t.id === fromId)
  const toIndex = lista.findIndex((t) => t.id === toId)
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return

  const [moved] = lista.splice(fromIndex, 1)
  if (!moved) return
  lista.splice(toIndex, 0, moved)

  const reindexada = lista.map((t, i) => ({ ...t, ordem: i }))
  const ordemAntes = new Map(snapshot.map((t, i) => [t.id, t.ordem ?? i]))
  const itens = reindexada
    .filter((t) => ordemAntes.get(t.id) !== t.ordem)
    .map((t) => ({ id: t.id, ordem: t.ordem }))

  if (!itens.length) return

  termosStore.definirListaCompleta(wid, reindexada)
  reordenando.value = true
  try {
    await $fetch<ProdutosTermosPesquisaReordenarResponse>(
      '/api/produtos/termos-de-pesquisa/reordenar',
      {
        method: 'POST',
        body: {
          workspace_id: wid,
          itens,
        },
      },
    )
  } catch (err) {
    termosStore.definirListaCompleta(wid, snapshot)
    toast.error(mensagemErroFetch(err, 'Não foi possível reordenar a categoria.'))
  } finally {
    reordenando.value = false
  }
}

async function carregar(opts?: { autoSelecionar?: boolean }) {
  const wid = props.workspaceId
  if (wid == null || wid < 1) {
    erro.value = null
    return
  }
  pending.value = true
  erro.value = null
  try {
    await termosStore.carregarListaCompletaSeNecessario(wid)
    if (opts?.autoSelecionar === true) {
      tentarAutoSelecionar()
    }
  } catch (err) {
    erro.value = mensagemErroFetch(err, 'Não foi possível carregar as categorias.')
  } finally {
    pending.value = false
  }
}

function tentarAutoSelecionar() {
  const lista = termos.value
  if (!lista.length) return
  if (props.selectedId != null && lista.some((t) => t.id === props.selectedId)) return
  emit('selecionar', { ...lista[0]! })
}

watch(
  () => props.workspaceId,
  () => {
    if (import.meta.server) return
    filtro.value = ''
    void carregar()
  },
  { immediate: true },
)

function aoSelecionar(termo: ProdutoTermoPesquisaItem) {
  emit('selecionar', termo)
}

function abrirCriar() {
  modoModal.value = 'criar'
  termoEmEdicao.value = null
  nomeModal.value = filtro.value.trim()
  modalFormAberto.value = true
}

function abrirEditarTermo(termo: ProdutoTermoPesquisaItem) {
  modoModal.value = 'editar'
  termoEmEdicao.value = { ...termo }
  nomeModal.value = termo.nome
  modalFormAberto.value = true
}

function cancelarModalForm() {
  if (guardandoModal.value) return
  modalFormAberto.value = false
  termoEmEdicao.value = null
  nomeModal.value = ''
  modoModal.value = 'criar'
}

async function confirmarModalForm() {
  const wid = props.workspaceId
  if (wid == null || wid < 1) return
  const nome = nomeModal.value.trim()
  if (!nome) {
    toast.error(config.erroNomeVazio)
    return
  }

  if (modoModal.value === 'criar') {
    guardandoModal.value = true
    try {
      const res = await $fetch<ProdutosTermoPesquisaCriarResponse>(config.apiBase, {
        method: 'POST',
        body: { workspace_id: wid, nome },
      })
      termosStore.aposCriarOuExistirTermo(wid, res.data)
      cancelarModalForm()
      emit('selecionar', { ...res.data })
      if (res.ja_existia) toast.info(config.toastJaExistia)
      else toast.success(config.toastCriado)
    } catch (err) {
      toast.error(mensagemErroFetch(err, config.erroCriar))
    } finally {
      guardandoModal.value = false
    }
    return
  }

  const itemId = termoEmEdicao.value?.id
  if (itemId == null) return
  guardandoModal.value = true
  try {
    const res = await $fetch<ProdutosTermoPesquisaAtualizarResponse>(config.apiItem(itemId), {
      method: 'PATCH',
      body: { workspace_id: wid, nome },
    })
    termosStore.substituirTermo(wid, res.data)
    cancelarModalForm()
    if (props.selectedId === itemId) {
      emit('selecionar', { ...res.data })
    }
    toast.success(config.toastAtualizado)
  } catch (err) {
    toast.error(mensagemErroFetch(err, config.erroAtualizar))
  } finally {
    guardandoModal.value = false
  }
}

function abrirEliminarTermo(termo: ProdutoTermoPesquisaItem) {
  termoAEliminar.value = { ...termo }
  alertaEliminarAberto.value = true
}

function cancelarEliminar() {
  if (eliminandoId.value != null) return
  alertaEliminarAberto.value = false
  termoAEliminar.value = null
}

async function confirmarEliminar() {
  const wid = props.workspaceId
  const item = termoAEliminar.value
  if (wid == null || wid < 1 || !item) return
  eliminandoId.value = item.id
  try {
    await $fetch<ProdutosTermoPesquisaEliminarResponse>(config.apiItem(item.id), {
      method: 'DELETE',
      query: { workspace_id: wid },
    })
    termosStore.removerTermo(wid, item.id)
    alertaEliminarAberto.value = false
    termoAEliminar.value = null
    if (props.selectedId === item.id) {
      const restante = termosStore.getListaCompletaCopia(wid)
      if (restante.length) emit('selecionar', { ...restante[0]! })
      else emit('selecionar', null)
    }
    toast.success(config.toastEliminado)
  } catch (err) {
    toast.error(mensagemErroFetch(err, config.erroEliminar))
  } finally {
    eliminandoId.value = null
  }
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col overflow-hidden bg-surface-container-lowest dark:bg-dark-surface-container-lowest">
    <div
      class="flex shrink-0 items-center justify-between gap-2 border-b border-outline/25 px-3 py-3 dark:border-dark-outline/25"
    >
      <h2 class="font-headline text-base font-bold text-on-surface dark:text-dark-on-surface">
        Categorias
      </h2>
      <button
        type="button"
        class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-primary transition-colors hover:bg-primary/10 dark:text-dark-primary dark:hover:bg-dark-primary/15"
        aria-label="Criar categoria"
        title="Criar categoria"
        @click="abrirCriar"
      >
        <span class="material-symbols-outlined text-[22px]" aria-hidden="true">add</span>
      </button>
    </div>

    <div class="shrink-0 border-b border-outline/20 px-3 py-2 dark:border-dark-outline/20">
      <label class="relative block">
        <span class="sr-only">Filtrar categorias</span>
        <span
          class="material-symbols-outlined pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant dark:text-dark-on-surface-variant"
          aria-hidden="true"
        >
          search
        </span>
        <input
          v-model="filtro"
          type="search"
          autocomplete="off"
          placeholder="Filtrar…"
          class="w-full rounded-lg border border-outline/35 bg-surface py-2 pl-9 pr-2 text-sm text-on-surface outline-none placeholder:text-on-surface-variant/70 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-dark-outline/35 dark:bg-dark-surface dark:text-dark-on-surface dark:placeholder:text-dark-on-surface-variant/70 dark:focus:border-dark-primary dark:focus:ring-dark-primary/20"
        >
      </label>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto">
      <p
        v-if="pending"
        class="px-3 py-6 text-center text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
      >
        A carregar…
      </p>

      <p
        v-else-if="erro"
        class="px-3 py-4 text-sm text-error dark:text-dark-error"
        role="alert"
      >
        {{ erro }}
      </p>

      <p
        v-else-if="!termos.length"
        class="px-3 py-6 text-center text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
      >
        Nenhuma categoria cadastrada. Use o + para criar.
      </p>

      <p
        v-else-if="!termosFiltrados.length"
        class="px-3 py-6 text-center text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
      >
        Nenhuma categoria no filtro.
      </p>

      <ul v-else class="divide-y divide-outline/20 dark:divide-dark-outline/20" role="list">
        <li
          v-for="termo in termosFiltrados"
          :key="termo.id"
          :class="{
            'opacity-40': dragTermoId === termo.id,
            'ring-2 ring-inset ring-primary/35':
              dragOverTermoId === termo.id && dragTermoId != null && dragTermoId !== termo.id,
          }"
          @dragover="onTermoDragOver(termo.id, $event)"
          @drop="onTermoDrop(termo.id, $event)"
          @dragend="onTermoDragEnd"
        >
          <div
            class="flex items-stretch gap-0.5 px-1.5 py-1"
            :class="
              selectedId === termo.id
                ? 'bg-surface-container-high dark:bg-dark-surface-container-high'
                : 'hover:bg-surface-container-low dark:hover:bg-dark-surface-container-low'
            "
          >
            <button
              v-if="podeReordenarTermos"
              type="button"
              class="inline-flex w-6 shrink-0 cursor-grab items-center justify-center self-stretch rounded-md text-on-surface-variant/70 transition-colors hover:bg-surface-container-high hover:text-on-surface active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40 dark:text-dark-on-surface-variant/70 dark:hover:bg-dark-surface-container-high dark:hover:text-dark-on-surface"
              :disabled="reordenando"
              draggable="true"
              aria-label="Arrastar para reordenar"
              title="Arrastar para reordenar"
              @click.stop
              @dragstart.stop="onTermoDragStart(termo.id, $event)"
            >
              <span class="material-symbols-outlined text-[20px] leading-none" aria-hidden="true">
                drag_indicator
              </span>
            </button>
            <button
              type="button"
              class="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:focus-visible:ring-dark-primary/40"
              :aria-current="selectedId === termo.id ? 'true' : undefined"
              @click="aoSelecionar(termo)"
            >
              <span class="min-w-0 flex-1 truncate text-sm font-medium text-on-surface dark:text-dark-on-surface">
                {{ termo.nome }}
              </span>
            </button>
            <button
              type="button"
              :class="iconEditarClass"
              aria-label="Editar categoria"
              title="Editar categoria"
              :disabled="eliminandoId === termo.id || reordenando"
              @click.stop="abrirEditarTermo(termo)"
            >
              <span class="material-symbols-outlined text-[18px]" aria-hidden="true">edit</span>
            </button>
            <button
              type="button"
              :class="iconEliminarClass"
              aria-label="Eliminar categoria"
              title="Eliminar categoria"
              :disabled="eliminandoId === termo.id || reordenando"
              @click.stop="abrirEliminarTermo(termo)"
            >
              <span class="material-symbols-outlined text-[18px]" aria-hidden="true">delete</span>
            </button>
          </div>
        </li>
      </ul>
    </div>

    <BaseModal
      v-model:open="modalFormAberto"
      :title="tituloModal"
      panel-class="w-full max-w-md"
      :show-close="!guardandoModal"
      :close-on-backdrop="!guardandoModal"
      :close-on-escape="!guardandoModal"
      @close="cancelarModalForm"
    >
      <div class="space-y-4">
        <div>
          <label
            class="mb-1.5 block text-xs font-medium uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant"
          >
            {{ config.labelNomeCampo }}
          </label>
          <BaseInput
            v-model="nomeModal"
            autocomplete="off"
            :placeholder="config.placeholderEdicao"
            :disabled="guardandoModal"
            @keydown.enter.prevent="confirmarModalForm"
          />
        </div>

        <div class="flex justify-end gap-2 pt-1">
          <BaseButton
            :block="false"
            variant="secondary"
            size="sm"
            :disabled="guardandoModal"
            @click="cancelarModalForm"
          >
            Cancelar
          </BaseButton>
          <BaseButton
            :block="false"
            variant="primary"
            size="sm"
            :disabled="guardandoModal || !nomeModal.trim()"
            @click="confirmarModalForm"
          >
            {{
              guardandoModal
                ? modoModal === 'criar'
                  ? 'A criar…'
                  : 'A guardar…'
                : modoModal === 'criar'
                  ? 'Criar'
                  : 'Salvar'
            }}
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
      :confirmar-desabilitado="eliminandoId != null"
      :cancelar-desabilitado="eliminandoId != null"
      @confirmar="confirmarEliminar"
      @cancelar="cancelarEliminar"
    />
  </div>
</template>
