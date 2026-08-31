<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import type {
  ProdutoTermoPesquisaItem,
  ProdutoWorkspacePatch,
  ProdutosTermoPesquisaAtualizarResponse,
  ProdutosTermoPesquisaCriarResponse,
  ProdutosTermoPesquisaEliminarResponse,
} from '#shared/types/produtos'
import BaseButton from '~/components/BaseButton.vue'
import BaseInput from '~/components/BaseInput.vue'
import BaseModal from '~/components/BaseModal.vue'
import ModalAlerta from '~/components/ModalAlerta.vue'
import ProdutosSelecaoMultiplaPainel from './ProdutosSelecaoMultiplaPainel.vue'
import { CONFIG_SELECAO_MULTIPLA, type ItemSelecaoMultipla } from './produtosSelecaoMultiplaConfig'
import { useProdutoTermosPesquisaStore } from '~/stores/produtoTermosPesquisa'
import { calcDropdownPanelStyle } from '~/components/produtos/produtosDropdownPos'
import { mensagemErroFetch } from '~/stores/canais'

const config = CONFIG_SELECAO_MULTIPLA

const props = withDefaults(
  defineProps<{
    workspaceId?: number | null
    disabled?: boolean
    produtoId?: number
    termos?: ProdutoTermoPesquisaItem[]
  }>(),
  {
    workspaceId: null,
    disabled: false,
    produtoId: undefined,
    termos: () => [],
  },
)

const emit = defineEmits<{
  commit: [patch: ProdutoWorkspacePatch]
}>()

const filtro = ref('')
const sugestoes = ref<ItemSelecaoMultipla[]>([])
const selecionados = ref<ItemSelecaoMultipla[]>([])
const painelAberto = ref(false)
const buscando = ref(false)
const ultimaBuscaTexto = ref('')
const ultimaBuscaComFiltroNome = ref(false)
const criando = ref(false)
const itemEmEdicao = ref<ItemSelecaoMultipla | null>(null)
const nomeModal = ref('')
const modalFormAberto = ref(false)
const modoModal = ref<'criar' | 'editar'>('criar')
const itemAEliminar = ref<ItemSelecaoMultipla | null>(null)
const alertaEliminarAberto = ref(false)
const eliminandoId = ref<number | null>(null)
const guardandoModal = ref(false)
const indiceDestaque = ref(-1)
const panelStyle = ref<Record<string, string>>({})
const rootRef = ref<HTMLElement | null>(null)
const painelDropdownRef = ref<HTMLElement | null>(null)
const painelConteudoRef = ref<InstanceType<typeof ProdutosSelecaoMultiplaPainel> | null>(null)
const listaSugestoesRef = ref<HTMLUListElement | null>(null)

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let removeScrollListeners: (() => void) | null = null
let removeDocMousedown: (() => void) | null = null

const tituloModal = computed(() =>
  modoModal.value === 'criar' ? config.tituloCriar : config.tituloEditar,
)

const textoAlertaEliminar = computed(() =>
  itemAEliminar.value ? config.labelEliminarConfirm(itemAEliminar.value.nome) : '',
)

function limparTimers() {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
}

function limparPainelESugestoes() {
  sugestoes.value = []
  buscando.value = false
  ultimaBuscaTexto.value = ''
  ultimaBuscaComFiltroNome.value = false
  criando.value = false
  indiceDestaque.value = -1
}

function sincronizarSelecionadosComProps() {
  selecionados.value = (props.termos ?? []).map((t) => ({ ...t }))
}

function resetarEstadoFechado() {
  limparTimers()
  sincronizarSelecionadosComProps()
  filtro.value = ''
  limparPainelESugestoes()
}

watch(
  () => props.produtoId,
  () => {
    painelAberto.value = false
    resetarEstadoFechado()
  },
)

watch(
  () => props.termos,
  () => {
    sincronizarSelecionadosComProps()
    if (!painelAberto.value) {
      filtro.value = ''
      limparPainelESugestoes()
    }
  },
  { deep: true, immediate: true },
)

const idsSelecionados = computed(() => new Set(selecionados.value.map((t) => t.id)))

const mostrarPainel = computed(() => painelAberto.value)

function emitCommit() {
  emit('commit', { termos_pesquisa_ids: selecionados.value.map((t) => t.id) })
}

function estaSelecionado(id: number): boolean {
  return idsSelecionados.value.has(id)
}

function toggleItem(item: ItemSelecaoMultipla) {
  if (props.disabled) return
  if (estaSelecionado(item.id)) {
    selecionados.value = selecionados.value.filter((x) => x.id !== item.id)
  } else {
    selecionados.value = [...selecionados.value, { ...item }].sort((a, b) =>
      a.nome.localeCompare(b.nome, 'pt', { sensitivity: 'base' }),
    )
  }
  emitCommit()
  void nextTick(() => painelConteudoRef.value?.focusFiltro())
}

function removerChip(item: ItemSelecaoMultipla) {
  if (props.disabled) return
  selecionados.value = selecionados.value.filter((x) => x.id !== item.id)
  emitCommit()
}

function updatePanelPos() {
  const el = rootRef.value
  if (!el || !mostrarPainel.value) return
  panelStyle.value = calcDropdownPanelStyle(el.getBoundingClientRect(), {
    minWidth: 220,
    maxWidth: 280,
  })
}

function attachScrollListeners() {
  detachScrollListeners()
  const fn = () => void nextTick(() => updatePanelPos())
  window.addEventListener('scroll', fn, true)
  window.addEventListener('resize', fn)
  removeScrollListeners = () => {
    window.removeEventListener('scroll', fn, true)
    window.removeEventListener('resize', fn)
    removeScrollListeners = null
  }
}

function detachScrollListeners() {
  removeScrollListeners?.()
}

function onDocumentMouseDown(ev: MouseEvent) {
  if (!painelAberto.value || props.disabled) return
  if (modalFormAberto.value || alertaEliminarAberto.value) return
  const t = ev.target as Node
  if (rootRef.value?.contains(t) || painelDropdownRef.value?.contains(t)) return
  painelAberto.value = false
  filtro.value = ''
}

function attachFecharFora() {
  removeDocMousedown?.()
  const fn = (e: MouseEvent) => onDocumentMouseDown(e)
  document.addEventListener('mousedown', fn, true)
  removeDocMousedown = () => {
    document.removeEventListener('mousedown', fn, true)
    removeDocMousedown = null
  }
}

function fecharPainel() {
  painelAberto.value = false
  filtro.value = ''
}

watch(mostrarPainel, (aberto) => {
  if (aberto) {
    void nextTick(() => {
      updatePanelPos()
      attachScrollListeners()
      attachFecharFora()
    })
  } else {
    detachScrollListeners()
    removeDocMousedown?.()
    panelStyle.value = {}
  }
})

onUnmounted(() => {
  limparTimers()
  detachScrollListeners()
  removeDocMousedown?.()
})

async function buscarItens(opts?: { listaCompletaNoWorkspace?: boolean }) {
  const wid = props.workspaceId
  if (wid == null || wid < 1) return
  const texto = filtro.value.trim()
  const listaCompleta = opts?.listaCompletaNoWorkspace === true
  const usarFiltroNome = texto.length > 0 && !listaCompleta
  ultimaBuscaTexto.value = texto
  ultimaBuscaComFiltroNome.value = usarFiltroNome
  const store = useProdutoTermosPesquisaStore()
  buscando.value = !store.temListaCompletaCarregada(wid)
  try {
    await store.carregarListaCompletaSeNecessario(wid)
    sugestoes.value =
      listaCompleta || !usarFiltroNome
        ? store.getListaCompletaCopia(wid)
        : store.filtrarPorNome(wid, texto, 40)
  } catch {
    sugestoes.value = []
  } finally {
    buscando.value = false
    indiceDestaque.value = sugestoes.value.length > 0 ? 0 : -1
  }
}

function reaplicarSugestoesDaCache() {
  const wid = props.workspaceId
  if (wid == null || wid < 1) return
  const store = useProdutoTermosPesquisaStore()
  if (!store.temListaCompletaCarregada(wid)) return
  const texto = filtro.value.trim()
  sugestoes.value =
    ultimaBuscaComFiltroNome.value && texto.length > 0
      ? store.filtrarPorNome(wid, texto, 40)
      : store.getListaCompletaCopia(wid)
  indiceDestaque.value = sugestoes.value.length > 0 ? 0 : -1
}

function abrirPainel() {
  if (props.disabled) return
  painelAberto.value = true
  void buscarItens({ listaCompletaNoWorkspace: true })
  void nextTick(() => painelConteudoRef.value?.focusFiltro())
}

watch(filtro, () => {
  if (props.disabled || !painelAberto.value) return
  limparTimers()
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    void buscarItens({ listaCompletaNoWorkspace: false })
  }, 220)
})

function cancelarModalForm() {
  if (guardandoModal.value) return
  modalFormAberto.value = false
  itemEmEdicao.value = null
  nomeModal.value = ''
  modoModal.value = 'criar'
}

function abrirCriar() {
  if (props.disabled) return
  painelAberto.value = false
  modoModal.value = 'criar'
  itemEmEdicao.value = null
  nomeModal.value = filtro.value.trim()
  modalFormAberto.value = true
}

function iniciarEdicao(item: ItemSelecaoMultipla) {
  if (props.disabled) return
  painelAberto.value = false
  modoModal.value = 'editar'
  itemEmEdicao.value = { ...item }
  nomeModal.value = item.nome
  modalFormAberto.value = true
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
    criando.value = true
    guardandoModal.value = true
    try {
      const res = await $fetch<ProdutosTermoPesquisaCriarResponse>(config.apiBase, {
        method: 'POST',
        body: { workspace_id: wid, nome },
      })
      useProdutoTermosPesquisaStore().aposCriarOuExistirTermo(wid, res.data)
      if (!estaSelecionado(res.data.id)) {
        selecionados.value = [...selecionados.value, { ...res.data }].sort((a, b) =>
          a.nome.localeCompare(b.nome, 'pt', { sensitivity: 'base' }),
        )
      }
      filtro.value = ''
      reaplicarSugestoesDaCache()
      emitCommit()
      cancelarModalForm()
      if (res.ja_existia) toast.info(config.toastJaExistia)
      else toast.success(config.toastCriado)
    } catch (err) {
      toast.error(mensagemErroFetch(err, config.erroCriar))
    } finally {
      criando.value = false
      guardandoModal.value = false
    }
    return
  }

  const itemId = itemEmEdicao.value?.id
  if (itemId == null) return
  guardandoModal.value = true
  try {
    const res = await $fetch<ProdutosTermoPesquisaAtualizarResponse>(config.apiItem(itemId), {
      method: 'PATCH',
      body: { workspace_id: wid, nome },
    })
    useProdutoTermosPesquisaStore().substituirTermo(wid, res.data)
    selecionados.value = selecionados.value.map((t) => (t.id === itemId ? { ...res.data } : t))
    cancelarModalForm()
    reaplicarSugestoesDaCache()
    emitCommit()
    toast.success(config.toastAtualizado)
  } catch (err) {
    toast.error(mensagemErroFetch(err, config.erroAtualizar))
  } finally {
    guardandoModal.value = false
  }
}

function pedirEliminar(item: ItemSelecaoMultipla) {
  if (props.disabled) return
  painelAberto.value = false
  itemAEliminar.value = { ...item }
  alertaEliminarAberto.value = true
}

function cancelarEliminar() {
  if (eliminandoId.value != null) return
  alertaEliminarAberto.value = false
  itemAEliminar.value = null
}

async function confirmarEliminar() {
  const wid = props.workspaceId
  const item = itemAEliminar.value
  if (wid == null || wid < 1 || !item) return
  eliminandoId.value = item.id
  try {
    await $fetch<ProdutosTermoPesquisaEliminarResponse>(config.apiItem(item.id), {
      method: 'DELETE',
      query: { workspace_id: wid },
    })
    useProdutoTermosPesquisaStore().removerTermo(wid, item.id)
    if (itemEmEdicao.value?.id === item.id) cancelarModalForm()
    selecionados.value = selecionados.value.filter((x) => x.id !== item.id)
    alertaEliminarAberto.value = false
    itemAEliminar.value = null
    reaplicarSugestoesDaCache()
    emitCommit()
    toast.success(config.toastEliminado)
  } catch (err) {
    toast.error(mensagemErroFetch(err, config.erroEliminar))
  } finally {
    eliminandoId.value = null
  }
}

async function aoEnterPainel() {
  if (props.disabled || buscando.value || criando.value) return
  if (sugestoes.value.length > 0) {
    const i =
      indiceDestaque.value >= 0 && indiceDestaque.value < sugestoes.value.length
        ? indiceDestaque.value
        : 0
    toggleItem(sugestoes.value[i]!)
  }
}

watch(indiceDestaque, async (i) => {
  if (i < 0 || !listaSugestoesRef.value) return
  await nextTick()
  listaSugestoesRef.value
    .querySelector(`[data-item-idx="${i}"]`)
    ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
})

function hoverDestaque(i: number) {
  indiceDestaque.value = i
}

const chipClass =
  'inline-flex max-w-full items-center gap-0.5 rounded-full bg-zinc-200/90 px-2 py-0.5 text-[11px] font-medium text-zinc-700 dark:bg-zinc-700/90 dark:text-zinc-200'
const celulaClass =
  'flex min-h-[2.75rem] w-full cursor-pointer flex-wrap items-center gap-1 px-3 py-2 transition-colors duration-150 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/50'
const painelDropdownRootClass =
  'flex flex-col overflow-hidden rounded-xl border border-slate-600/90 bg-slate-900 text-slate-100 shadow-2xl ring-1 ring-white/10 dark:border-slate-500/80 dark:bg-slate-950 dark:ring-white/5'
const painelHeaderClass =
  'flex shrink-0 items-center justify-between gap-2 border-b border-slate-600/90 bg-slate-800/95 px-3 py-2 dark:border-slate-600/80 dark:bg-slate-900/95'
const inpFiltroClass =
  'block w-full rounded-lg border border-slate-600/80 bg-slate-800/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400/40'
const iconEditarClass =
  'inline-flex shrink-0 items-center justify-center self-center rounded-lg bg-sky-500/25 p-1.5 text-sky-200 transition-colors hover:bg-sky-500/45 hover:text-white disabled:pointer-events-none disabled:opacity-40'
const iconEliminarClass =
  'inline-flex shrink-0 items-center justify-center self-center rounded-lg bg-red-500/25 p-1.5 text-red-200 transition-colors hover:bg-red-500/45 hover:text-white disabled:pointer-events-none disabled:opacity-40'
const itemSugestaoClass = (idx: number, selecionado: boolean) =>
  [
    'flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors',
    selecionado ? 'text-primary-200' : 'text-slate-100',
    idx === indiceDestaque.value
      ? 'bg-primary-500/30 ring-2 ring-inset ring-primary-400/55'
      : 'hover:bg-slate-800/90',
  ].join(' ')
</script>

<template>
  <div ref="rootRef" class="relative min-w-0 w-full">
    <div :class="celulaClass" @click="abrirPainel">
      <template v-if="selecionados.length">
        <span v-for="item in selecionados" :key="item.id" :class="chipClass">
          <span class="truncate">{{ item.nome }}</span>
          <button
            type="button"
            class="ml-0.5 rounded-full p-0.5 text-zinc-500 hover:bg-zinc-300/80 hover:text-zinc-800 disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-600 dark:hover:text-white"
            :disabled="disabled"
            :aria-label="'Remover ' + item.nome"
            @click.stop="removerChip(item)"
          >
            <span class="material-symbols-outlined text-[14px] leading-none" aria-hidden="true">close</span>
          </button>
        </span>
      </template>
      <span v-else class="text-[13px] text-zinc-400 dark:text-zinc-500">{{ config.placeholderCelula }}</span>
    </div>

    <Teleport to="body">
      <div
        v-if="mostrarPainel && !disabled"
        ref="painelDropdownRef"
        role="listbox"
        :class="painelDropdownRootClass"
        :style="panelStyle"
      >
        <ProdutosSelecaoMultiplaPainel
          ref="painelConteudoRef"
          v-model:filtro="filtro"
          v-model:lista-sugestoes-ref="listaSugestoesRef"
          :buscando="buscando"
          :sugestoes="sugestoes"
          :criando="criando"
          :eliminando-id="eliminandoId"
          :disabled="disabled"
          :indice-destaque="indiceDestaque"
          :esta-selecionado="estaSelecionado"
          :item-sugestao-class="itemSugestaoClass"
          :inp-filtro-class="inpFiltroClass"
          :icon-editar-class="iconEditarClass"
          :icon-eliminar-class="iconEliminarClass"
          :painel-header-class="painelHeaderClass"
          @fechar="fecharPainel"
          @enter-filtro="aoEnterPainel"
          @toggle="toggleItem"
          @iniciar-edicao="iniciarEdicao"
          @eliminar="pedirEliminar"
          @abrir-criar="abrirCriar"
          @hover-destaque="hoverDestaque"
        />
      </div>
    </Teleport>
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
</template>
