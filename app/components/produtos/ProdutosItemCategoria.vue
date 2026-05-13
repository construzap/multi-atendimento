<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import type {
  ProdutoCategoriaItem,
  ProdutoWorkspacePatch,
  ProdutosCategoriaAtualizarResponse,
  ProdutosCategoriaCriarResponse,
  ProdutosCategoriaEliminarResponse,
} from '#shared/types/produtos'
import BaseInput from '~/components/BaseInput.vue'
import { useProdutoCategoriasStore } from '~/stores/produtoCategorias'
import { mensagemErroFetch } from '~/stores/canais'

type SelecaoCategoria = { id: number; nome: string }

const props = withDefaults(
  defineProps<{
    workspaceId?: number | null
    /** `form` = modal Novo produto (painel absoluto + BaseInput). `celula` = tabela (Teleport + commit no blur). */
    variant: 'form' | 'celula'
    disabled?: boolean
    /** Só `celula`: id do produto (ids únicos no DOM). */
    produtoId?: number
    categoriaId?: number | null
    categoriaNome?: string | null
    /** Só `form`: id do `<input>` (acessibilidade). */
    inputId?: string
    placeholder?: string
    /**
     * Só `form`: quando passa a `false` (ex.: modal fechou), limpa estado interno e o `v-model:selecao`.
     */
    ativo?: boolean
  }>(),
  {
    workspaceId: null,
    disabled: false,
    produtoId: undefined,
    categoriaId: null,
    categoriaNome: null,
    inputId: undefined,
    placeholder: 'Comece a digitar para buscar…',
    ativo: true,
  },
)

const modeloSelecao = defineModel<SelecaoCategoria | null>('selecao', { default: null })

const emit = defineEmits<{
  /** Só `celula`: PATCH inline na API de produtos. */
  commit: [patch: ProdutoWorkspacePatch]
}>()

const filtro = ref('')
const sugestoes = ref<ProdutoCategoriaItem[]>([])
const painelAberto = ref(false)
const buscando = ref(false)
const ultimaBuscaTexto = ref('')
/** Só `true` quando a última resposta veio de pedido com `q` (evita «criar» após lista completa ao focar). */
const ultimaBuscaComFiltroNome = ref(false)
const criando = ref(false)
const editandoCategoriaId = ref<number | null>(null)
const nomeEdicao = ref('')
const eliminandoId = ref<number | null>(null)
const guardandoEdicao = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)
const listaSugestoesRef = ref<HTMLUListElement | null>(null)
/** Índice na lista de sugestões (setas); Enter escolhe este item. */
const indiceDestaque = ref(-1)
const panelStyle = ref<Record<string, string>>({})
const suprimirBlurCommit = ref(false)
const inputInteragido = ref(false)
const rootRef = ref<HTMLElement | null>(null)
const painelDropdownRef = ref<HTMLElement | null>(null)

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let removeScrollListeners: (() => void) | null = null
let removeDocMousedown: (() => void) | null = null

const isForm = computed(() => props.variant === 'form')
const isCelula = computed(() => props.variant === 'celula')

function limparTimers() {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
}

function limparPainelESugestoes() {
  sugestoes.value = []
  painelAberto.value = false
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
  filtro.value = (props.categoriaNome ?? '').trim() ? String(props.categoriaNome) : ''
  limparPainelESugestoes()
  inputInteragido.value = false
}

watch(
  () => [props.produtoId, props.categoriaId, props.categoriaNome, props.variant] as const,
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
    if (v && v.nome) {
      filtro.value = v.nome
    }
    limparPainelESugestoes()
    inputInteragido.value = false
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
      inputInteragido.value = false
    }
  },
)

const mostrarOpcaoCriar = computed(() => {
  if (!painelAberto.value || buscando.value || criando.value) return false
  const t = filtro.value.trim()
  if (!t) return false
  if (!ultimaBuscaComFiltroNome.value) return false
  if (t !== ultimaBuscaTexto.value) return false
  if (sugestoes.value.length > 0) return false
  return true
})

const mostrarPainel = computed(
  () => painelAberto.value && (buscando.value || sugestoes.value.length > 0 || mostrarOpcaoCriar.value),
)

function updatePanelPos() {
  if (!isCelula.value) return
  const el = inputRef.value
  if (!el || !mostrarPainel.value) return
  const r = el.getBoundingClientRect()
  const w = Math.max(r.width, 280)
  const margin = 8
  let left = r.left
  left = Math.max(margin, Math.min(left, window.innerWidth - w - margin))
  const maxH = Math.min(280, Math.floor(window.innerHeight * 0.45))
  const spaceBelow = window.innerHeight - r.bottom - margin * 2
  const openUp = spaceBelow < 120 && r.top > 160
  if (openUp) {
    panelStyle.value = {
      position: 'fixed',
      left: `${left}px`,
      bottom: `${window.innerHeight - r.top + margin}px`,
      width: `${w}px`,
      maxHeight: `${maxH}px`,
      zIndex: '200',
    }
  } else {
    panelStyle.value = {
      position: 'fixed',
      left: `${left}px`,
      top: `${r.bottom + margin}px`,
      width: `${w}px`,
      maxHeight: `${maxH}px`,
      zIndex: '200',
    }
  }
}

function attachScrollListeners() {
  detachScrollListeners()
  const fn = () => {
    void nextTick(() => updatePanelPos())
  }
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

function detachFecharFora() {
  removeDocMousedown?.()
}

function onDocumentMouseDown(ev: MouseEvent) {
  if (!painelAberto.value || props.disabled) return
  const t = ev.target as Node
  if (rootRef.value?.contains(t)) return
  if (painelDropdownRef.value?.contains(t)) return
  painelAberto.value = false
}

function attachFecharFora() {
  detachFecharFora()
  const fn = (e: MouseEvent) => onDocumentMouseDown(e)
  document.addEventListener('mousedown', fn, true)
  removeDocMousedown = () => {
    document.removeEventListener('mousedown', fn, true)
    removeDocMousedown = null
  }
}

function fecharPainelDropdown() {
  painelAberto.value = false
}

watch(mostrarPainel, (aberto) => {
  if (aberto) {
    void nextTick(() => {
      if (isCelula.value) {
        updatePanelPos()
        attachScrollListeners()
      }
      attachFecharFora()
    })
  } else {
    if (isCelula.value) {
      detachScrollListeners()
      panelStyle.value = {}
    }
    detachFecharFora()
  }
})

onUnmounted(() => {
  limparTimers()
  detachScrollListeners()
  detachFecharFora()
})

async function buscarCategorias(opts?: { listaCompletaNoWorkspace?: boolean }) {
  const wid = props.workspaceId
  if (wid == null || wid < 1) return
  const texto = filtro.value.trim()
  const listaCompleta = opts?.listaCompletaNoWorkspace === true
  const usarFiltroNome = texto.length > 0 && !listaCompleta

  ultimaBuscaTexto.value = texto
  ultimaBuscaComFiltroNome.value = usarFiltroNome

  const catStore = useProdutoCategoriasStore()
  const temCache = catStore.temListaCompletaCarregada(wid)
  buscando.value = !temCache

  try {
    await catStore.carregarListaCompletaSeNecessario(wid)
    if (listaCompleta || !usarFiltroNome) {
      sugestoes.value = catStore.getListaCompletaCopia(wid)
    } else {
      sugestoes.value = catStore.filtrarPorNome(wid, texto, 30)
    }
  } catch {
    sugestoes.value = []
  } finally {
    buscando.value = false
    const n = sugestoes.value.length
    if (n > 0) {
      if (indiceDestaque.value < 0 || indiceDestaque.value >= n) indiceDestaque.value = 0
    } else {
      indiceDestaque.value = -1
    }
  }
}

/** Mantém a lista visível alinhada à cache após PATCH/DELETE na Pinia. */
function reaplicarSugestoesDaCache() {
  const wid = props.workspaceId
  if (wid == null || wid < 1) return
  const catStore = useProdutoCategoriasStore()
  if (!catStore.temListaCompletaCarregada(wid)) return
  const texto = filtro.value.trim()
  if (ultimaBuscaComFiltroNome.value && texto.length > 0) {
    sugestoes.value = catStore.filtrarPorNome(wid, texto, 30)
  } else {
    sugestoes.value = catStore.getListaCompletaCopia(wid)
  }
  const n = sugestoes.value.length
  if (n > 0) {
    if (indiceDestaque.value < 0 || indiceDestaque.value >= n) indiceDestaque.value = 0
  } else {
    indiceDestaque.value = -1
  }
}

function cancelarEdicaoCategoria() {
  editandoCategoriaId.value = null
  nomeEdicao.value = ''
}

function iniciarEdicaoCategoria(c: ProdutoCategoriaItem) {
  editandoCategoriaId.value = c.id
  nomeEdicao.value = c.nome
}

async function confirmarEdicaoCategoria(categoriaId: number) {
  const wid = props.workspaceId
  if (wid == null || wid < 1) return
  const nome = nomeEdicao.value.trim()
  if (!nome) {
    toast.error('Informe o nome da categoria.')
    return
  }
  guardandoEdicao.value = true
  try {
    const res = await $fetch<ProdutosCategoriaAtualizarResponse>(`/api/produtos/categorias/${categoriaId}`, {
      method: 'PATCH',
      body: { workspace_id: wid, nome },
    })
    useProdutoCategoriasStore().substituirCategoria(wid, res.data)
    cancelarEdicaoCategoria()
    if (isForm.value && modeloSelecao.value?.id === categoriaId) {
      modeloSelecao.value = { id: categoriaId, nome: res.data.nome }
    }
    if (isCelula.value && props.categoriaId === categoriaId) {
      filtro.value = res.data.nome
      emit('commit', { categoria: res.data.nome })
    }
    reaplicarSugestoesDaCache()
    toast.success('Categoria atualizada.')
  } catch (err) {
    toast.error(mensagemErroFetch(err, 'Não foi possível atualizar a categoria.'))
  } finally {
    guardandoEdicao.value = false
  }
}

async function eliminarCategoria(c: ProdutoCategoriaItem) {
  const wid = props.workspaceId
  if (wid == null || wid < 1) return
  const ok = window.confirm(
    `Eliminar a categoria «${c.nome}»? Os produtos que usam esta categoria ficam sem categoria.`,
  )
  if (!ok) return
  suprimirBlurCommit.value = true
  eliminandoId.value = c.id
  try {
    await $fetch<ProdutosCategoriaEliminarResponse>(`/api/produtos/categorias/${c.id}`, {
      method: 'DELETE',
      query: { workspace_id: wid },
    })
    useProdutoCategoriasStore().removerCategoria(wid, c.id)
    if (editandoCategoriaId.value === c.id) cancelarEdicaoCategoria()
    if (isForm.value && modeloSelecao.value?.id === c.id) {
      modeloSelecao.value = null
    }
    if (isCelula.value && props.categoriaId === c.id) {
      filtro.value = ''
      emit('commit', { categoria_id: null })
    }
    reaplicarSugestoesDaCache()
    toast.success('Categoria eliminada.')
  } catch (err) {
    toast.error(mensagemErroFetch(err, 'Não foi possível eliminar a categoria.'))
    suprimirBlurCommit.value = false
  } finally {
    eliminandoId.value = null
    agendarFimSuprimirBlur()
  }
}

function selecaoAtualNome(): string | null {
  if (isForm.value) return modeloSelecao.value?.nome?.trim() ?? null
  const id = props.categoriaId
  const nome = (props.categoriaNome ?? '').trim()
  if (id != null && id > 0 && nome) return nome
  return null
}

watch(filtro, (v) => {
  if (props.disabled) return
  const selNome = selecaoAtualNome()
  if (selNome != null && v.trim() === selNome) return
  if (isForm.value && modeloSelecao.value && v.trim() !== modeloSelecao.value.nome) {
    modeloSelecao.value = null
  }
  limparTimers()
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    void buscarCategorias({ listaCompletaNoWorkspace: false })
    if (isCelula.value) {
      if (inputInteragido.value) painelAberto.value = true
    } else {
      painelAberto.value = true
    }
  }, 220)
})

function aoFocus(e: FocusEvent) {
  if (props.disabled) return
  if (isCelula.value) {
    const t = e.target as Node | null
    if (!inputRef.value || (t !== inputRef.value && !inputRef.value.contains(t))) return
    inputInteragido.value = true
  }
  painelAberto.value = true
  void buscarCategorias({ listaCompletaNoWorkspace: true })
}

function escolher(c: ProdutoCategoriaItem) {
  cancelarEdicaoCategoria()
  suprimirBlurCommit.value = true
  indiceDestaque.value = -1
  filtro.value = c.nome
  painelAberto.value = false
  if (isForm.value) {
    modeloSelecao.value = { id: c.id, nome: c.nome }
  } else {
    emit('commit', { categoria_id: c.id })
  }
  agendarFimSuprimirBlur()
}

async function criarDigitada() {
  const wid = props.workspaceId
  const nome = filtro.value.trim()
  if (wid == null || wid < 1 || !nome) return
  suprimirBlurCommit.value = true
  criando.value = true
  try {
    const res = await $fetch<ProdutosCategoriaCriarResponse>('/api/produtos/categorias', {
      method: 'POST',
      body: { workspace_id: wid, nome },
    })
    useProdutoCategoriasStore().aposCriarOuExistirCategoria(wid, res.data)
    escolher(res.data)
    if (res.ja_existia) {
      toast.info('Já existia uma categoria com esse nome; foi selecionada.')
    } else {
      toast.success('Categoria criada.')
    }
  } catch (err) {
    toast.error(mensagemErroFetch(err, 'Não foi possível criar a categoria.'))
    suprimirBlurCommit.value = false
  } finally {
    criando.value = false
  }
}

function aoBlur() {
  if (!isCelula.value) return
  if (suprimirBlurCommit.value) return
  const atualNome = (props.categoriaNome ?? '').trim()
  const t = filtro.value.trim()
  if (t === atualNome) return
  if (!t.length) {
    if (props.categoriaId != null || atualNome) emit('commit', { categoria: '' })
    return
  }
  const selNome = selecaoAtualNome()
  if (selNome != null && t === selNome) return
  emit('commit', { categoria: t })
}

function moveDestaque(delta: number) {
  const n = sugestoes.value.length
  if (!painelAberto.value || buscando.value || n === 0) return
  if (indiceDestaque.value < 0 || indiceDestaque.value >= n) {
    indiceDestaque.value = delta > 0 ? 0 : n - 1
    return
  }
  indiceDestaque.value = (indiceDestaque.value + delta + n) % n
}

async function aoEnter() {
  if (props.disabled || buscando.value || criando.value) return
  if (mostrarOpcaoCriar.value) {
    const t = filtro.value.trim()
    if (t) await criarDigitada()
    return
  }
  if (sugestoes.value.length > 0) {
    const i =
      indiceDestaque.value >= 0 && indiceDestaque.value < sugestoes.value.length
        ? indiceDestaque.value
        : 0
    escolher(sugestoes.value[i]!)
    return
  }
  if (isCelula.value) {
    inputRef.value?.blur()
  }
}

function onKeydownRaiz(ev: KeyboardEvent) {
  if (props.disabled) return
  if (ev.key === 'ArrowDown') {
    ev.preventDefault()
    moveDestaque(1)
    return
  }
  if (ev.key === 'ArrowUp') {
    ev.preventDefault()
    moveDestaque(-1)
    return
  }
  if (ev.key === 'Enter') {
    ev.preventDefault()
    void aoEnter()
  }
}

function onKeydownCelula(ev: KeyboardEvent) {
  if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp' || ev.key === 'Enter') {
    ev.preventDefault()
    if (ev.key === 'ArrowDown') moveDestaque(1)
    else if (ev.key === 'ArrowUp') moveDestaque(-1)
    else void aoEnter()
  }
}

watch(indiceDestaque, async (i) => {
  if (i < 0 || !listaSugestoesRef.value) return
  await nextTick()
  const el = listaSugestoesRef.value.querySelector(`[data-cat-idx="${i}"]`) as HTMLElement | null
  el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
})

function hoverDestaque(i: number) {
  indiceDestaque.value = i
}

const itemSugestaoClass = (idx: number) =>
  [
    'flex min-w-0 flex-1 items-center px-3 py-2.5 text-left text-sm text-slate-100 transition-colors',
    idx === indiceDestaque.value
      ? 'bg-primary-500/30 ring-2 ring-inset ring-primary-400/55'
      : 'hover:bg-slate-800/90',
  ].join(' ')

const iconAcaoCategoriaClass =
  'inline-flex shrink-0 items-center justify-center rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-700/85 hover:text-slate-100 disabled:pointer-events-none disabled:opacity-40'

const inpEdicaoCategoriaClass =
  'min-w-0 flex-1 rounded-lg border border-slate-500/80 bg-slate-800/80 px-2.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400/40'

const inputIdCelula = computed(() =>
  props.produtoId != null ? `prod-item-cat-${props.produtoId}` : 'prod-item-cat',
)

/** Painel tipo «dropdown» escuro (lista + fechar). */
const painelDropdownRootClass =
  'flex max-h-[min(22rem,50vh)] flex-col overflow-hidden rounded-xl border border-slate-600/90 bg-slate-900 text-slate-100 shadow-2xl ring-1 ring-white/10 dark:border-slate-500/80 dark:bg-slate-950 dark:ring-white/5'

const painelHeaderClass =
  'flex shrink-0 items-center justify-between gap-2 border-b border-slate-600/90 bg-slate-800/95 px-3 py-2 dark:border-slate-600/80 dark:bg-slate-900/95'

const inpCelulaClass =
  'block w-full min-w-0 rounded-md border border-transparent bg-transparent px-3 py-2.5 text-sm text-on-surface shadow-none transition-colors placeholder:text-outline/45 hover:border-outline/25 focus:border-primary-500 focus:bg-surface-container-low/90 focus:outline-none focus:ring-1 focus:ring-primary-500/30 disabled:opacity-50 dark:text-dark-on-surface dark:placeholder:text-dark-outline/45 dark:hover:border-dark-outline/30 dark:focus:bg-dark-surface-container-low/90 dark:focus:border-primary-400'
</script>

<template>
  <div ref="rootRef" class="relative min-w-0 w-full" @focusin="aoFocus">
    <div v-if="isForm" class="w-full" @keydown="onKeydownRaiz">
      <BaseInput
        :id="inputId"
        v-model="filtro"
        :placeholder="placeholder"
        autocomplete="off"
        :disabled="disabled"
      />
    </div>
    <input
      v-else
      :id="inputIdCelula"
      ref="inputRef"
      v-model="filtro"
      type="text"
      autocomplete="off"
      :disabled="disabled"
      placeholder="Buscar ou criar…"
      :class="inpCelulaClass"
      @blur="aoBlur"
      @keydown="onKeydownCelula"
    />

    <Teleport v-if="isCelula" to="body">
      <div
        v-if="mostrarPainel && !disabled"
        ref="painelDropdownRef"
        role="listbox"
        :class="painelDropdownRootClass"
        :style="panelStyle"
        @mousedown.prevent
      >
        <div :class="painelHeaderClass">
          <span class="text-[11px] font-bold uppercase tracking-wide text-slate-400">Categorias</span>
          <button
            type="button"
            class="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-700/80 hover:text-slate-100"
            aria-label="Fechar lista"
            @mousedown.prevent.stop="fecharPainelDropdown"
          >
            <span class="material-symbols-outlined text-[22px] leading-none" aria-hidden="true">close</span>
          </button>
        </div>
        <div
          v-if="buscando"
          class="px-4 py-3 text-sm text-slate-400"
        >
          A procurar…
        </div>
        <ul
          v-else-if="sugestoes.length > 0"
          ref="listaSugestoesRef"
          class="min-h-0 flex-1 overflow-y-auto py-1"
        >
          <li
            v-for="(c, idx) in sugestoes"
            :key="c.id"
            class="flex min-w-0 items-stretch gap-0.5 border-b border-slate-700/40 px-1 py-0.5 last:border-b-0"
          >
            <template v-if="editandoCategoriaId === c.id">
              <input
                v-model="nomeEdicao"
                type="text"
                autocomplete="off"
                :class="inpEdicaoCategoriaClass"
                :disabled="guardandoEdicao"
                placeholder="Nome da categoria"
                @mousedown.stop
                @keydown.enter.prevent="confirmarEdicaoCategoria(c.id)"
                @keydown.escape.prevent="cancelarEdicaoCategoria()"
              />
              <button
                type="button"
                :class="iconAcaoCategoriaClass"
                aria-label="Guardar nome"
                :disabled="guardandoEdicao"
                @mousedown.stop.prevent="confirmarEdicaoCategoria(c.id)"
              >
                <span class="material-symbols-outlined text-[20px] leading-none" aria-hidden="true">check</span>
              </button>
              <button
                type="button"
                :class="iconAcaoCategoriaClass"
                aria-label="Cancelar edição"
                :disabled="guardandoEdicao"
                @mousedown.stop.prevent="cancelarEdicaoCategoria()"
              >
                <span class="material-symbols-outlined text-[20px] leading-none" aria-hidden="true">close</span>
              </button>
            </template>
            <template v-else>
              <button
                type="button"
                role="option"
                :data-cat-idx="idx"
                :class="itemSugestaoClass(idx)"
                @mouseenter="hoverDestaque(idx)"
                @mousedown.prevent="escolher(c)"
              >
                <span class="block min-w-0 truncate">{{ c.nome }}</span>
              </button>
              <button
                type="button"
                :class="iconAcaoCategoriaClass"
                aria-label="Editar categoria"
                :disabled="disabled || eliminandoId === c.id || guardandoEdicao"
                @mousedown.stop.prevent="iniciarEdicaoCategoria(c)"
              >
                <span class="material-symbols-outlined text-[20px] leading-none" aria-hidden="true">edit</span>
              </button>
              <button
                type="button"
                :class="iconAcaoCategoriaClass"
                aria-label="Eliminar categoria"
                :disabled="disabled || eliminandoId === c.id || guardandoEdicao"
                @mousedown.stop.prevent="eliminarCategoria(c)"
              >
                <span class="material-symbols-outlined text-[20px] leading-none" aria-hidden="true">close</span>
              </button>
            </template>
          </li>
        </ul>
        <div
          v-else-if="mostrarOpcaoCriar"
          class="border-t border-slate-600/80 px-4 py-3"
        >
          <p class="mb-2 text-xs text-slate-400">
            Nenhuma categoria encontrada para «<span class="font-semibold text-slate-200">{{ filtro.trim() }}</span>».
          </p>
          <button
            type="button"
            class="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/70 bg-amber-200/95 px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition-colors hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="criando"
            @mousedown.prevent="criarDigitada"
          >
            <span class="material-symbols-outlined text-[20px] text-inherit" aria-hidden="true">add</span>
            {{ criando ? 'A criar…' : `Criar «${filtro.trim()}»` }}
          </button>
        </div>
      </div>
    </Teleport>

    <div
      v-else-if="isForm && mostrarPainel && !disabled"
      ref="painelDropdownRef"
      role="listbox"
      :class="['absolute z-50 mt-1 w-full', painelDropdownRootClass]"
    >
      <div :class="painelHeaderClass">
        <span class="text-[11px] font-bold uppercase tracking-wide text-slate-400">Categorias</span>
        <button
          type="button"
          class="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-700/80 hover:text-slate-100"
          aria-label="Fechar lista"
          @mousedown.prevent.stop="fecharPainelDropdown"
        >
          <span class="material-symbols-outlined text-[22px] leading-none" aria-hidden="true">close</span>
        </button>
      </div>
      <div
        v-if="buscando"
        class="px-4 py-3 text-sm text-slate-400"
      >
        A procurar…
      </div>
      <ul
        v-else-if="sugestoes.length > 0"
        ref="listaSugestoesRef"
        class="min-h-0 flex-1 overflow-y-auto py-1"
      >
        <li
          v-for="(c, idx) in sugestoes"
          :key="c.id"
          class="flex min-w-0 items-stretch gap-0.5 border-b border-slate-700/40 px-1 py-0.5 last:border-b-0"
        >
          <template v-if="editandoCategoriaId === c.id">
            <input
              v-model="nomeEdicao"
              type="text"
              autocomplete="off"
              :class="inpEdicaoCategoriaClass"
              :disabled="guardandoEdicao"
              placeholder="Nome da categoria"
              @mousedown.stop
              @keydown.enter.prevent="confirmarEdicaoCategoria(c.id)"
              @keydown.escape.prevent="cancelarEdicaoCategoria()"
            />
            <button
              type="button"
              :class="iconAcaoCategoriaClass"
              aria-label="Guardar nome"
              :disabled="guardandoEdicao"
              @mousedown.stop.prevent="confirmarEdicaoCategoria(c.id)"
            >
              <span class="material-symbols-outlined text-[20px] leading-none" aria-hidden="true">check</span>
            </button>
            <button
              type="button"
              :class="iconAcaoCategoriaClass"
              aria-label="Cancelar edição"
              :disabled="guardandoEdicao"
              @mousedown.stop.prevent="cancelarEdicaoCategoria()"
            >
              <span class="material-symbols-outlined text-[20px] leading-none" aria-hidden="true">close</span>
            </button>
          </template>
          <template v-else>
            <button
              type="button"
              role="option"
              :data-cat-idx="idx"
              :class="itemSugestaoClass(idx)"
              @mouseenter="hoverDestaque(idx)"
              @mousedown.prevent="escolher(c)"
            >
              <span class="block min-w-0 truncate">{{ c.nome }}</span>
            </button>
            <button
              type="button"
              :class="iconAcaoCategoriaClass"
              aria-label="Editar categoria"
              :disabled="disabled || eliminandoId === c.id || guardandoEdicao"
              @mousedown.stop.prevent="iniciarEdicaoCategoria(c)"
            >
              <span class="material-symbols-outlined text-[20px] leading-none" aria-hidden="true">edit</span>
            </button>
            <button
              type="button"
              :class="iconAcaoCategoriaClass"
              aria-label="Eliminar categoria"
              :disabled="disabled || eliminandoId === c.id || guardandoEdicao"
              @mousedown.stop.prevent="eliminarCategoria(c)"
            >
              <span class="material-symbols-outlined text-[20px] leading-none" aria-hidden="true">close</span>
            </button>
          </template>
        </li>
      </ul>
      <div
        v-else-if="mostrarOpcaoCriar"
        class="border-t border-slate-600/80 px-4 py-3"
      >
        <p class="mb-2 text-xs text-slate-400">
          Nenhuma categoria encontrada para «<span class="font-semibold text-slate-200">{{ filtro.trim() }}</span>».
        </p>
        <button
          type="button"
          class="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/70 bg-amber-200/95 px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition-colors hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="criando"
          @mousedown.prevent="criarDigitada"
        >
          <span class="material-symbols-outlined text-[20px] text-inherit" aria-hidden="true">add</span>
          {{ criando ? 'A criar…' : `Criar «${filtro.trim()}»` }}
        </button>
      </div>
    </div>
  </div>
</template>
