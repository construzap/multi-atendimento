<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import type {
  ProdutoWorkspacePatch,
  ProdutosCategoriaAtualizarResponse,
  ProdutosCategoriaCriarResponse,
  ProdutosTermoPesquisaAtualizarResponse,
  ProdutosTermoPesquisaCriarResponse,
} from '#shared/types/produtos'
import BaseInput from '~/components/BaseInput.vue'
import ProdutosSelecaoUnicaPainel from './ProdutosSelecaoUnicaPainel.vue'
import {
  CONFIGS_SELECAO_UNICA,
  type CatalogoSelecaoUnica,
  type ItemSelecaoUnica,
} from './produtosSelecaoUnicaConfig'
import { useProdutoCategoriasStore } from '~/stores/produtoCategorias'
import { useProdutoTermosPesquisaStore } from '~/stores/produtoTermosPesquisa'
import { calcDropdownPanelStyle } from '~/components/produtos/produtosDropdownPos'
import { mensagemErroFetch } from '~/stores/canais'

const props = withDefaults(
  defineProps<{
    catalogo?: CatalogoSelecaoUnica
    /** `form` = modal/criar produto. `celula` = tabela inline. */
    variant?: 'form' | 'celula'
    workspaceId?: number | null
    disabled?: boolean
    produtoId?: number
    /** Só `catalogo="categoria"`. */
    categoriaId?: number | null
    categoriaNome?: string | null
    /** Só `catalogo="termos_pesquisa"`. */
    termoId?: number | null
    termoNome?: string | null
    inputId?: string
    placeholder?: string
    ativo?: boolean
  }>(),
  {
    catalogo: 'categoria',
    variant: 'celula',
    workspaceId: null,
    disabled: false,
    produtoId: undefined,
    categoriaId: null,
    categoriaNome: null,
    termoId: null,
    termoNome: null,
    placeholder: undefined,
    ativo: true,
  },
)

const modeloSelecao = defineModel<ItemSelecaoUnica | null>('selecao', { default: null })

const emit = defineEmits<{
  commit: [patch: ProdutoWorkspacePatch]
}>()

const config = computed(() => CONFIGS_SELECAO_UNICA[props.catalogo])
const isForm = computed(() => props.variant === 'form')
const isCelula = computed(() => props.variant === 'celula')
const isTermos = computed(() => props.catalogo === 'termos_pesquisa')

const filtro = ref('')
const sugestoes = ref<ItemSelecaoUnica[]>([])
const selecionado = ref<ItemSelecaoUnica | null>(null)
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
const suprimirBlurCommit = ref(false)
const rootRef = ref<HTMLElement | null>(null)
const painelDropdownRef = ref<HTMLElement | null>(null)
const painelComponentRef = ref<InstanceType<typeof ProdutosSelecaoUnicaPainel> | null>(null)
const listaSugestoesRef = ref<HTMLUListElement | null>(null)

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let removeScrollListeners: (() => void) | null = null
let removeDocMousedown: (() => void) | null = null

const placeholderEfetivo = computed(
  () => props.placeholder ?? (isForm.value ? config.value.placeholderForm : config.value.placeholderFiltro),
)

function itemIdProps(): { id: number | null; nome: string } {
  if (isTermos.value) {
    return { id: props.termoId ?? null, nome: (props.termoNome ?? '').trim() }
  }
  return { id: props.categoriaId ?? null, nome: (props.categoriaNome ?? '').trim() }
}

function temCacheLista(wid: number): boolean {
  if (isTermos.value) {
    return useProdutoTermosPesquisaStore().temListaCompletaCarregada(wid)
  }
  return useProdutoCategoriasStore().temListaCompletaCarregada(wid)
}

async function carregarListaCompleta(wid: number) {
  if (isTermos.value) {
    await useProdutoTermosPesquisaStore().carregarListaCompletaSeNecessario(wid)
  } else {
    await useProdutoCategoriasStore().carregarListaCompletaSeNecessario(wid)
  }
}

function getListaCopia(wid: number): ItemSelecaoUnica[] {
  if (isTermos.value) {
    return useProdutoTermosPesquisaStore().getListaCompletaCopia(wid)
  }
  return useProdutoCategoriasStore().getListaCompletaCopia(wid)
}

function filtrarPorNome(wid: number, texto: string): ItemSelecaoUnica[] {
  const limite = isTermos.value ? 40 : 30
  if (isTermos.value) {
    return useProdutoTermosPesquisaStore().filtrarPorNome(wid, texto, limite)
  }
  return useProdutoCategoriasStore().filtrarPorNome(wid, texto, limite)
}

function substituirItemCache(wid: number, item: ItemSelecaoUnica) {
  if (isTermos.value) {
    useProdutoTermosPesquisaStore().substituirTermo(wid, item)
  } else {
    useProdutoCategoriasStore().substituirCategoria(wid, item)
  }
}

function removerItemCache(wid: number, id: number) {
  if (isTermos.value) {
    useProdutoTermosPesquisaStore().removerTermo(wid, id)
  } else {
    useProdutoCategoriasStore().removerCategoria(wid, id)
  }
}

function aposCriarCache(wid: number, item: ItemSelecaoUnica) {
  if (isTermos.value) {
    useProdutoTermosPesquisaStore().aposCriarOuExistirTermo(wid, item)
  } else {
    useProdutoCategoriasStore().aposCriarOuExistirCategoria(wid, item)
  }
}

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

function agendarFimSuprimirBlur() {
  void nextTick(() => {
    void nextTick(() => {
      suprimirBlurCommit.value = false
    })
  })
}

function sincronizarCelulaComProps() {
  limparTimers()
  const { id, nome } = itemIdProps()
  selecionado.value = id != null && id > 0 && nome ? { id, nome } : null
  filtro.value = ''
  limparPainelESugestoes()
}

watch(
  () =>
    [
      props.produtoId,
      props.catalogo,
      props.categoriaId,
      props.categoriaNome,
      props.termoId,
      props.termoNome,
      props.variant,
    ] as const,
  () => {
    if (!isCelula.value) return
    sincronizarCelulaComProps()
  },
  { immediate: true },
)

watch(
  () => modeloSelecao.value,
  (v) => {
    if (!isForm.value) return
    if (v?.nome) filtro.value = v.nome
    limparPainelESugestoes()
    painelAberto.value = false
  },
  { immediate: true },
)

watch(
  () => props.ativo,
  (v, prev) => {
    if (!isForm.value) return
    if (v === false && prev === true) {
      modeloSelecao.value = null
      filtro.value = ''
      limparTimers()
      limparPainelESugestoes()
      painelAberto.value = false
    }
  },
)

const mostrarOpcaoCriar = computed(() => {
  if (!painelAberto.value || buscando.value || criando.value) return false
  const t = filtro.value.trim()
  if (!t || !ultimaBuscaComFiltroNome.value || t !== ultimaBuscaTexto.value) return false
  return sugestoes.value.length === 0
})

const mostrarPainel = computed(() => {
  if (!painelAberto.value) return false
  if (isCelula.value) return true
  return buscando.value || sugestoes.value.length > 0 || mostrarOpcaoCriar.value || filtro.value.length > 0
})

function emitCommit() {
  if (!isCelula.value) return
  const id = selecionado.value?.id ?? null
  if (isTermos.value) {
    emit('commit', { termos_pesquisa_ids: id != null ? [id] : [] })
  } else {
    emit('commit', { categoria_id: id })
  }
}

function escolherItem(item: ItemSelecaoUnica) {
  if (props.disabled) return
  cancelarEdicao()
  suprimirBlurCommit.value = true
  selecionado.value = { ...item }
  filtro.value = item.nome
  painelAberto.value = false
  if (isForm.value) {
    modeloSelecao.value = { id: item.id, nome: item.nome }
  } else {
    emitCommit()
  }
  agendarFimSuprimirBlur()
}

function removerChip() {
  if (props.disabled) return
  selecionado.value = null
  if (isForm.value) {
    modeloSelecao.value = null
    filtro.value = ''
  } else {
    emitCommit()
  }
}

function updatePanelPos() {
  const el = rootRef.value
  if (!el || !mostrarPainel.value) return
  panelStyle.value = calcDropdownPanelStyle(el.getBoundingClientRect(), { minWidth: 280 })
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
}

watch(mostrarPainel, (aberto) => {
  if (aberto) {
    void nextTick(async () => {
      updatePanelPos()
      if (isCelula.value) attachScrollListeners()
      attachFecharFora()
      await focarInputPainel()
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
  buscando.value = !temCacheLista(wid)
  try {
    await carregarListaCompleta(wid)
    sugestoes.value =
      listaCompleta || !usarFiltroNome ? getListaCopia(wid) : filtrarPorNome(wid, texto)
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
  if (!temCacheLista(wid)) return
  const texto = filtro.value.trim()
  sugestoes.value =
    ultimaBuscaComFiltroNome.value && texto.length > 0
      ? filtrarPorNome(wid, texto)
      : getListaCopia(wid)
  indiceDestaque.value = sugestoes.value.length > 0 ? 0 : -1
}

async function focarInputPainel() {
  await nextTick()
  painelComponentRef.value?.focusFiltro?.()
}

async function abrirPainel() {
  if (props.disabled) return
  filtro.value = ''
  ultimaBuscaTexto.value = ''
  ultimaBuscaComFiltroNome.value = false
  painelAberto.value = true
  await buscarItens({ listaCompletaNoWorkspace: true })
  await focarInputPainel()
}

function onClickCelula(ev: MouseEvent) {
  if (!isCelula.value || props.disabled) return
  if ((ev.target as HTMLElement).closest('button')) return
  void abrirPainel()
}

defineExpose({ abrirPainel })

function selecaoAtualNome(): string | null {
  if (isForm.value) return modeloSelecao.value?.nome?.trim() ?? null
  const { id, nome } = itemIdProps()
  return id != null && id > 0 && nome ? nome : null
}

watch(filtro, () => {
  if (props.disabled) return
  const selNome = selecaoAtualNome()
  if (selNome != null && filtro.value.trim() === selNome) return
  if (isForm.value && modeloSelecao.value && filtro.value.trim() !== modeloSelecao.value.nome) {
    modeloSelecao.value = null
  }
  if (isForm.value) painelAberto.value = true
  if (!painelAberto.value && !isForm.value) return
  limparTimers()
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    void buscarItens({ listaCompletaNoWorkspace: false })
  }, 220)
})

function aoFocusForm() {
  if (props.disabled) return
  painelAberto.value = true
  void buscarItens({ listaCompletaNoWorkspace: true })
}

function cancelarEdicao() {
  editandoItemId.value = null
  nomeEdicao.value = ''
}

function iniciarEdicao(item: ItemSelecaoUnica) {
  editandoItemId.value = item.id
  nomeEdicao.value = item.nome
}

async function confirmarEdicao(itemId: number) {
  const wid = props.workspaceId
  if (wid == null || wid < 1) return
  const nome = nomeEdicao.value.trim()
  if (!nome) {
    toast.error(config.value.erroNomeVazio)
    return
  }
  guardandoEdicao.value = true
  try {
    const url = config.value.apiItem(itemId)
    const body = { workspace_id: wid, nome }
    let data: ItemSelecaoUnica
    if (isTermos.value) {
      const res = await $fetch<ProdutosTermoPesquisaAtualizarResponse>(url, { method: 'PATCH', body })
      data = res.data
    } else {
      const res = await $fetch<ProdutosCategoriaAtualizarResponse>(url, { method: 'PATCH', body })
      data = res.data
    }
    substituirItemCache(wid, data)
    if (selecionado.value?.id === itemId) selecionado.value = { ...data }
    if (isForm.value && modeloSelecao.value?.id === itemId) {
      modeloSelecao.value = { id: itemId, nome: data.nome }
      filtro.value = data.nome
    }
    cancelarEdicao()
    reaplicarSugestoesDaCache()
    if (isCelula.value) emitCommit()
    toast.success(config.value.toastAtualizado)
  } catch (err) {
    toast.error(mensagemErroFetch(err, config.value.erroAtualizar))
  } finally {
    guardandoEdicao.value = false
  }
}

async function eliminarItem(item: ItemSelecaoUnica) {
  const wid = props.workspaceId
  if (wid == null || wid < 1) return
  if (!window.confirm(config.value.labelEliminarConfirm(item.nome))) return
  suprimirBlurCommit.value = true
  eliminandoId.value = item.id
  try {
    await $fetch(config.value.apiItem(item.id), {
      method: 'DELETE',
      query: { workspace_id: wid },
    })
    removerItemCache(wid, item.id)
    if (editandoItemId.value === item.id) cancelarEdicao()
    if (selecionado.value?.id === item.id) selecionado.value = null
    if (isForm.value && modeloSelecao.value?.id === item.id) {
      modeloSelecao.value = null
      filtro.value = ''
    }
    reaplicarSugestoesDaCache()
    if (isCelula.value) emitCommit()
    toast.success(config.value.toastEliminado)
  } catch (err) {
    toast.error(mensagemErroFetch(err, config.value.erroEliminar))
    suprimirBlurCommit.value = false
  } finally {
    eliminandoId.value = null
    agendarFimSuprimirBlur()
  }
}

async function criarDigitado() {
  const wid = props.workspaceId
  const nome = filtro.value.trim()
  if (wid == null || wid < 1 || !nome) return
  suprimirBlurCommit.value = true
  criando.value = true
  try {
    const body = { workspace_id: wid, nome }
    let data: ItemSelecaoUnica
    let jaExistia = false
    if (isTermos.value) {
      const res = await $fetch<ProdutosTermoPesquisaCriarResponse>(config.value.apiBase, {
        method: 'POST',
        body,
      })
      data = res.data
      jaExistia = res.ja_existia
    } else {
      const res = await $fetch<ProdutosCategoriaCriarResponse>(config.value.apiBase, {
        method: 'POST',
        body,
      })
      data = res.data
      jaExistia = res.ja_existia
    }
    aposCriarCache(wid, data)
    escolherItem(data)
    if (jaExistia) toast.info(config.value.toastJaExistia)
    else toast.success(config.value.toastCriado)
  } catch (err) {
    toast.error(mensagemErroFetch(err, config.value.erroCriar))
    suprimirBlurCommit.value = false
  } finally {
    criando.value = false
  }
}

function moveDestaque(delta: number) {
  const n = sugestoes.value.length
  if (!painelAberto.value || buscando.value || n === 0) return
  indiceDestaque.value =
    indiceDestaque.value < 0 || indiceDestaque.value >= n
      ? delta > 0 ? 0 : n - 1
      : (indiceDestaque.value + delta + n) % n
}

async function aoEnterPainel() {
  if (props.disabled || buscando.value || criando.value) return
  if (mostrarOpcaoCriar.value) {
    await criarDigitado()
    return
  }
  if (sugestoes.value.length > 0) {
    const i = indiceDestaque.value >= 0 && indiceDestaque.value < sugestoes.value.length ? indiceDestaque.value : 0
    escolherItem(sugestoes.value[i]!)
  }
}

function onKeydownForm(ev: KeyboardEvent) {
  if (props.disabled) return
  if (ev.key === 'ArrowDown') { ev.preventDefault(); moveDestaque(1); return }
  if (ev.key === 'ArrowUp') { ev.preventDefault(); moveDestaque(-1); return }
  if (ev.key === 'Enter') { ev.preventDefault(); void aoEnterPainel() }
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
const itemSugestaoClass = (idx: number) =>
  ['flex min-w-0 flex-1 items-center px-3 py-2.5 text-left text-sm text-slate-100 transition-colors', idx === indiceDestaque.value ? 'bg-primary-500/30 ring-2 ring-inset ring-primary-400/55' : 'hover:bg-slate-800/90'].join(' ')
</script>

<template>
  <div
    ref="rootRef"
    class="relative min-w-0 w-full"
    @click="onClickCelula"
    @focusin="isForm ? aoFocusForm() : undefined"
  >
    <div v-if="isForm" class="w-full" @keydown="onKeydownForm">
      <BaseInput :id="inputId" v-model="filtro" :placeholder="placeholderEfetivo" autocomplete="off" :disabled="disabled" @focus="aoFocusForm" />
    </div>
    <div v-else :class="celulaClass">
      <span v-if="selecionado" :class="chipClass">
        <span class="truncate">{{ selecionado.nome }}</span>
        <button type="button" class="ml-0.5 rounded-full p-0.5 text-zinc-500 hover:bg-zinc-300/80 hover:text-zinc-800 disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-600 dark:hover:text-white" :disabled="disabled" :aria-label="'Remover ' + selecionado.nome" @click.stop="removerChip">
          <span class="material-symbols-outlined text-[14px] leading-none" aria-hidden="true">close</span>
        </button>
      </span>
      <span v-else-if="itemIdProps().nome" class="text-[13px] font-medium text-zinc-700 dark:text-zinc-200">
        {{ itemIdProps().nome }}
      </span>
      <span v-else class="text-[13px] text-zinc-400 dark:text-zinc-500">{{ config.placeholderCelula }}</span>
    </div>

    <Teleport v-if="isCelula" to="body">
      <div v-if="mostrarPainel && !disabled" ref="painelDropdownRef" role="listbox" :class="painelDropdownRootClass" :style="panelStyle">
        <ProdutosSelecaoUnicaPainel
          ref="painelComponentRef"
          v-model:filtro="filtro"
          v-model:nome-edicao="nomeEdicao"
          v-model:lista-sugestoes-ref="listaSugestoesRef"
          :config="config"
          :buscando="buscando"
          :sugestoes="sugestoes"
          :mostrar-opcao-criar="mostrarOpcaoCriar"
          :criando="criando"
          :editando-item-id="editandoItemId"
          :guardando-edicao="guardandoEdicao"
          :eliminando-id="eliminandoId"
          :disabled="disabled"
          :indice-destaque="indiceDestaque"
          :item-sugestao-class="itemSugestaoClass"
          :inp-filtro-class="inpFiltroClass"
          :inp-edicao-class="inpEdicaoClass"
          :icon-acao-class="iconAcaoClass"
          :painel-header-class="painelHeaderClass"
          @fechar="fecharPainel"
          @enter-filtro="mostrarOpcaoCriar ? criarDigitado() : aoEnterPainel()"
          @escolher="escolherItem"
          @iniciar-edicao="iniciarEdicao"
          @confirmar-edicao="confirmarEdicao"
          @cancelar-edicao="cancelarEdicao"
          @eliminar="eliminarItem"
          @criar="criarDigitado"
          @hover-destaque="hoverDestaque"
        />
      </div>
    </Teleport>

    <div v-else-if="isForm && mostrarPainel && !disabled" ref="painelDropdownRef" role="listbox" :class="['absolute z-50 mt-1 w-full', painelDropdownRootClass]">
      <ProdutosSelecaoUnicaPainel
        v-model:filtro="filtro"
        v-model:nome-edicao="nomeEdicao"
        v-model:lista-sugestoes-ref="listaSugestoesRef"
        :config="config"
        :buscando="buscando"
        :sugestoes="sugestoes"
        :mostrar-opcao-criar="mostrarOpcaoCriar"
        :criando="criando"
        :editando-item-id="editandoItemId"
        :guardando-edicao="guardandoEdicao"
        :eliminando-id="eliminandoId"
        :disabled="disabled"
        :indice-destaque="indiceDestaque"
        :item-sugestao-class="itemSugestaoClass"
        :inp-filtro-class="inpFiltroClass"
        :inp-edicao-class="inpEdicaoClass"
        :icon-acao-class="iconAcaoClass"
        :painel-header-class="painelHeaderClass"
        :mostrar-filtro="false"
        @fechar="fecharPainel"
        @escolher="escolherItem"
        @iniciar-edicao="iniciarEdicao"
        @confirmar-edicao="confirmarEdicao"
        @cancelar-edicao="cancelarEdicao"
        @eliminar="eliminarItem"
        @criar="criarDigitado"
        @hover-destaque="hoverDestaque"
      />
    </div>
  </div>
</template>
