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
const editandoItemId = ref<number | null>(null)
const nomeEdicao = ref('')
const eliminandoId = ref<number | null>(null)
const guardandoEdicao = ref(false)
const indiceDestaque = ref(-1)
const panelStyle = ref<Record<string, string>>({})
const suprimirFechar = ref(false)
const rootRef = ref<HTMLElement | null>(null)
const painelDropdownRef = ref<HTMLElement | null>(null)
const painelConteudoRef = ref<InstanceType<typeof ProdutosSelecaoMultiplaPainel> | null>(null)
const listaSugestoesRef = ref<HTMLUListElement | null>(null)

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let removeScrollListeners: (() => void) | null = null
let removeDocMousedown: (() => void) | null = null

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
    // Enquanto o painel está aberto, não limpar filtro/sugestões (permite continuar a pesquisar).
    if (!painelAberto.value) {
      filtro.value = ''
      limparPainelESugestoes()
    }
  },
  { deep: true, immediate: true },
)

const idsSelecionados = computed(() => new Set(selecionados.value.map((t) => t.id)))

const mostrarOpcaoCriar = computed(() => {
  if (!painelAberto.value || buscando.value || criando.value) return false
  const t = filtro.value.trim()
  if (!t || !ultimaBuscaComFiltroNome.value || t !== ultimaBuscaTexto.value) return false
  return sugestoes.value.length === 0
})

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
  panelStyle.value = calcDropdownPanelStyle(el.getBoundingClientRect(), { minWidth: 300 })
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
    sugestoes.value = listaCompleta || !usarFiltroNome ? store.getListaCompletaCopia(wid) : store.filtrarPorNome(wid, texto, 40)
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
  sugestoes.value = ultimaBuscaComFiltroNome.value && texto.length > 0 ? store.filtrarPorNome(wid, texto, 40) : store.getListaCompletaCopia(wid)
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

function cancelarEdicao() {
  editandoItemId.value = null
  nomeEdicao.value = ''
}

function iniciarEdicao(item: ItemSelecaoMultipla) {
  editandoItemId.value = item.id
  nomeEdicao.value = item.nome
}

async function confirmarEdicao(itemId: number) {
  const wid = props.workspaceId
  if (wid == null || wid < 1) return
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
    useProdutoTermosPesquisaStore().substituirTermo(wid, res.data)
    selecionados.value = selecionados.value.map((t) => (t.id === itemId ? { ...res.data } : t))
    cancelarEdicao()
    reaplicarSugestoesDaCache()
    emitCommit()
    toast.success(config.toastAtualizado)
  } catch (err) {
    toast.error(mensagemErroFetch(err, config.erroAtualizar))
  } finally {
    guardandoEdicao.value = false
  }
}

async function eliminarItem(item: ItemSelecaoMultipla) {
  const wid = props.workspaceId
  if (wid == null || wid < 1) return
  if (!window.confirm(config.labelEliminarConfirm(item.nome))) return
  suprimirFechar.value = true
  eliminandoId.value = item.id
  try {
    await $fetch<ProdutosTermoPesquisaEliminarResponse>(config.apiItem(item.id), {
      method: 'DELETE',
      query: { workspace_id: wid },
    })
    useProdutoTermosPesquisaStore().removerTermo(wid, item.id)
    if (editandoItemId.value === item.id) cancelarEdicao()
    selecionados.value = selecionados.value.filter((x) => x.id !== item.id)
    reaplicarSugestoesDaCache()
    emitCommit()
    toast.success(config.toastEliminado)
  } catch (err) {
    toast.error(mensagemErroFetch(err, config.erroEliminar))
  } finally {
    eliminandoId.value = null
    suprimirFechar.value = false
  }
}

async function criarDigitado() {
  const wid = props.workspaceId
  const nome = filtro.value.trim()
  if (wid == null || wid < 1 || !nome) return
  suprimirFechar.value = true
  criando.value = true
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
    void nextTick(() => painelConteudoRef.value?.focusFiltro())
    if (res.ja_existia) toast.info(config.toastJaExistia)
    else toast.success(config.toastCriado)
  } catch (err) {
    toast.error(mensagemErroFetch(err, config.erroCriar))
  } finally {
    criando.value = false
    suprimirFechar.value = false
  }
}

async function aoEnterPainel() {
  if (props.disabled || buscando.value || criando.value) return
  if (mostrarOpcaoCriar.value) {
    await criarDigitado()
    return
  }
  if (sugestoes.value.length > 0) {
    const i = indiceDestaque.value >= 0 && indiceDestaque.value < sugestoes.value.length ? indiceDestaque.value : 0
    toggleItem(sugestoes.value[i]!)
  }
}

watch(indiceDestaque, async (i) => {
  if (i < 0 || !listaSugestoesRef.value) return
  await nextTick()
  listaSugestoesRef.value.querySelector(`[data-item-idx="${i}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
})

function hoverDestaque(i: number) {
  indiceDestaque.value = i
}

const chipClass = 'inline-flex max-w-full items-center gap-0.5 rounded-full bg-zinc-200/90 px-2 py-0.5 text-[11px] font-medium text-zinc-700 dark:bg-zinc-700/90 dark:text-zinc-200'
const celulaClass = 'flex min-h-[2.75rem] w-full cursor-pointer flex-wrap items-center gap-1 px-3 py-2 transition-colors duration-150 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/50'
const painelDropdownRootClass =
  'flex flex-col overflow-hidden rounded-xl border border-slate-600/90 bg-slate-900 text-slate-100 shadow-2xl ring-1 ring-white/10 dark:border-slate-500/80 dark:bg-slate-950 dark:ring-white/5'
const painelHeaderClass = 'flex shrink-0 items-center justify-between gap-2 border-b border-slate-600/90 bg-slate-800/95 px-3 py-2 dark:border-slate-600/80 dark:bg-slate-900/95'
const inpFiltroClass = 'block w-full rounded-lg border border-slate-600/80 bg-slate-800/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400/40'
const inpEdicaoClass = 'min-w-0 flex-1 rounded-lg border border-slate-500/80 bg-slate-800/80 px-2.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400/40'
const iconAcaoClass = 'inline-flex shrink-0 items-center justify-center rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-700/85 hover:text-slate-100 disabled:pointer-events-none disabled:opacity-40'
const itemSugestaoClass = (idx: number, selecionado: boolean) =>
  ['flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors', selecionado ? 'text-primary-200' : 'text-slate-100', idx === indiceDestaque.value ? 'bg-primary-500/30 ring-2 ring-inset ring-primary-400/55' : 'hover:bg-slate-800/90'].join(' ')
</script>

<template>
  <div ref="rootRef" class="relative min-w-0 w-full">
    <div :class="celulaClass" @click="abrirPainel">
      <template v-if="selecionados.length">
        <span v-for="item in selecionados" :key="item.id" :class="chipClass">
          <span class="truncate">{{ item.nome }}</span>
          <button type="button" class="ml-0.5 rounded-full p-0.5 text-zinc-500 hover:bg-zinc-300/80 hover:text-zinc-800 disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-600 dark:hover:text-white" :disabled="disabled" :aria-label="'Remover ' + item.nome" @click.stop="removerChip(item)">
            <span class="material-symbols-outlined text-[14px] leading-none" aria-hidden="true">close</span>
          </button>
        </span>
      </template>
      <span v-else class="text-[13px] text-zinc-400 dark:text-zinc-500">{{ config.placeholderCelula }}</span>
    </div>

    <Teleport to="body">
      <div v-if="mostrarPainel && !disabled" ref="painelDropdownRef" role="listbox" :class="painelDropdownRootClass" :style="panelStyle">
        <ProdutosSelecaoMultiplaPainel
          ref="painelConteudoRef"
          v-model:filtro="filtro"
          v-model:nome-edicao="nomeEdicao"
          v-model:lista-sugestoes-ref="listaSugestoesRef"
          :buscando="buscando"
          :sugestoes="sugestoes"
          :mostrar-opcao-criar="mostrarOpcaoCriar"
          :criando="criando"
          :editando-item-id="editandoItemId"
          :guardando-edicao="guardandoEdicao"
          :eliminando-id="eliminandoId"
          :disabled="disabled"
          :indice-destaque="indiceDestaque"
          :esta-selecionado="estaSelecionado"
          :item-sugestao-class="itemSugestaoClass"
          :inp-filtro-class="inpFiltroClass"
          :inp-edicao-class="inpEdicaoClass"
          :icon-acao-class="iconAcaoClass"
          :painel-header-class="painelHeaderClass"
          @fechar="fecharPainel"
          @enter-filtro="mostrarOpcaoCriar ? criarDigitado() : aoEnterPainel()"
          @toggle="toggleItem"
          @iniciar-edicao="iniciarEdicao"
          @confirmar-edicao="confirmarEdicao"
          @cancelar-edicao="cancelarEdicao"
          @eliminar="eliminarItem"
          @criar="criarDigitado"
          @hover-destaque="hoverDestaque"
        />
      </div>
    </Teleport>
  </div>
</template>
