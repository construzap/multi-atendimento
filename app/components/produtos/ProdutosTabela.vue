<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import type {
  ProdutoAtualizarResponse,
  ProdutoSelecionadoRef,
  ProdutoWorkspaceCampos,
  ProdutoWorkspaceItem,
  ProdutoWorkspacePatch,
  ProdutosExcluirResponse,
} from '#shared/types/produtos'
import ProdutosModalImagens from '~/components/produtos/ProdutosModalImagens.vue'
import ProdutosModalNovaVariacao from '~/components/produtos/ProdutosModalNovaVariacao.vue'
import ProdutosSelecaoUnica from '~/components/produtos/selecao-unica/ProdutosSelecaoUnica.vue'
import ModalEnvioProdutos from '~/components/ModalEnvioProdutos.vue'
import { mensagemErroFetch } from '~/stores/canais'
import { useProdutoCategoriasStore } from '~/stores/produtoCategorias'
import { useProdutoTermosPesquisaStore } from '~/stores/produtoTermosPesquisa'
import { useProdutosStore } from '~/stores/produtos'
import { parseDecimalPtBr } from '~/utils/mapearLinhasImportacaoProduto'

const produtosStore = useProdutosStore()
const { items: itemsPinia } = storeToRefs(produtosStore)

/** Listagem API vem da Pinia; rascunho continua via prop. */
const itemsExibicao = computed(() =>
  props.modo === 'rascunho' ? props.items : itemsPinia.value,
)

const LS_LARGURAS = 'produtos-tabela-larguras-colunas-v6'
const CHUNK_EXCLUIR_PRODUTOS = 100

const columns = [
  { id: 'sel' as const, label: '' },
  { id: 'produto', label: 'PRODUTO' },
  // { id: 'categoria', label: 'CATEGORIA' },
  { id: 'termos', label: 'TERMOS PESQUISA' },
  { id: 'unidade', label: 'UNIDADE DE VENDA' },
  { id: 'marca', label: 'MARCA' },
  { id: 'preco_custo', label: 'PREÇO CUSTO' },
  { id: 'preco', label: 'PREÇO À VISTA' },
  { id: 'prazo', label: 'PREÇO A PRAZO' },
  { id: 'preco_promocional', label: 'PREÇO PROMO' },
  { id: 'peso', label: 'PESO (KG)' },
  { id: 'largura', label: 'LARG. (CM)' },
  { id: 'comprimento', label: 'COMP. (CM)' },
  { id: 'altura', label: 'ALT. (CM)' },
  { id: 'sku', label: 'SKU' },
  { id: 'codigo_ncm', label: 'NCM' },
  { id: 'codigo_barras', label: 'CÓDIGO BARRAS' },
  { id: 'infos', label: 'INFOS RELEVANTES' },
  { id: 'codigo', label: 'CÓDIGO' },
  { id: 'status', label: 'STATUS' },
] as const

type ColId = (typeof columns)[number]['id']

const DEFAULT_WIDTHS: Record<ColId, number> = {
  sel: 52,
  produto: 320,
  // categoria: 200,
  termos: 260,
  unidade: 200,
  marca: 180,
  preco_custo: 128,
  preco: 128,
  prazo: 128,
  preco_promocional: 140,
  peso: 118,
  largura: 120,
  comprimento: 130,
  altura: 120,
  sku: 132,
  codigo_ncm: 140,
  codigo_barras: 160,
  infos: 320,
  codigo: 104,
  status: 118,
} as Record<ColId, number>

function loadColWidths(): Record<ColId, number> {
  const base = { ...DEFAULT_WIDTHS }
  /* Node 25+ expõe `localStorage` no servidor; só aceder no browser (evita aviso --localstorage-file). */
  if (import.meta.server) return base
  try {
    const raw = localStorage.getItem(LS_LARGURAS)
    if (!raw) return base
    const o = JSON.parse(raw) as Record<string, number>
    for (const c of columns) {
      const n = Number(o[c.id])
      if (Number.isFinite(n) && n >= 56) base[c.id] = Math.min(720, n)
    }
  } catch {
    /* ignore */
  }
  return base
}

const colWidths = ref<Record<ColId, number>>(loadColWidths())
const tabelaScrollRef = ref<HTMLElement | null>(null)

/** Largura real da grelha (soma das colunas) para não comprimir com `w-full` + `table-fixed`. */
const larguraTabelaPx = computed(() =>
  columns.reduce((acc, c) => acc + (colWidths.value[c.id] ?? DEFAULT_WIDTHS[c.id]), 0),
)

const thClass =
  'relative bg-zinc-50 px-3 py-2 text-left align-middle text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400'

const tdClass = 'p-0 align-middle bg-transparent'

const celulaInnerClass =
  'flex min-h-[2.75rem] w-full cursor-text items-center px-3 py-2 transition-colors duration-150 hover:bg-zinc-100/80 focus-within:bg-white dark:hover:bg-zinc-800/50 dark:focus-within:bg-zinc-900'

/** Mesma altura/padding da célula interna (coluna PRODUTO e afins). */
const celulaLinhaClass =
  'flex min-h-[2.75rem] w-full items-center transition-colors duration-150 hover:bg-zinc-100/80 focus-within:bg-white dark:hover:bg-zinc-800/50 dark:focus-within:bg-zinc-900'

/** Ícone/miniatura do produto na coluna PRODUTO (estilo Notion). */
const iconImagemProdutoClass =
  'relative mr-2.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center overflow-hidden rounded-sm text-zinc-400 transition-colors hover:bg-zinc-200/70 hover:text-zinc-600 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-zinc-700 dark:hover:text-zinc-300'

const tdSelClass = 'group/check p-0 align-middle'
const thSelClass =
  'group/check relative bg-zinc-50 p-0 align-middle dark:bg-zinc-900'
const checkboxCelulaLabelClass =
  'flex min-h-[2.75rem] w-full cursor-pointer items-center justify-center px-2 py-2'
const checkboxCelulaLabelHeaderClass =
  'flex min-h-[2.75rem] w-full cursor-pointer items-center justify-center px-2 py-2'

/** Visual estilo Notion: oculto até hover da célula; permanece se marcado/indeterminado. */
const checkboxVisualBaseClass =
  'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] border transition-all duration-150 ease-out'
const checkboxVisualOcultoClass =
  'border-zinc-300/90 bg-white opacity-0 group-hover/check:opacity-100 dark:border-zinc-600 dark:bg-zinc-950'
const checkboxVisualMarcadoClass =
  'border-[#2383e2] bg-[#2383e2] opacity-100'

const inpClass =
  'block w-full min-w-0 border-0 bg-transparent px-0 py-0 text-[13px] font-normal leading-snug text-zinc-700 shadow-none outline-none ring-0 placeholder:text-zinc-400 focus:outline-none focus:ring-0 dark:text-zinc-300 dark:placeholder:text-zinc-500'

const inpClassProduto =
  'block w-full min-w-0 border-0 bg-transparent px-0 py-0 text-[13px] font-semibold leading-snug text-zinc-900 shadow-none outline-none ring-0 placeholder:text-zinc-400 focus:outline-none focus:ring-0 dark:text-zinc-50 dark:placeholder:text-zinc-500'

const trClassBase =
  'border-b border-zinc-200 transition-all duration-150 hover:bg-zinc-50 dark:border-zinc-700/70 dark:hover:bg-zinc-800/50 odd:bg-white even:bg-zinc-50/40 dark:odd:bg-zinc-950 dark:even:bg-zinc-900/25'

let resizeState: { colId: ColId; startX: number; startW: number } | null = null

function persistLarguras() {
  if (import.meta.server) return
  try {
    localStorage.setItem(LS_LARGURAS, JSON.stringify(colWidths.value))
  } catch {
    /* ignore */
  }
}

function onResizeMove(e: MouseEvent) {
  if (!resizeState) return
  const dx = e.clientX - resizeState.startX
  const next = Math.max(56, Math.min(720, resizeState.startW + dx))
  colWidths.value = { ...colWidths.value, [resizeState.colId]: next }
}

function onResizeEnd() {
  if (!resizeState) return
  resizeState = null
  document.body.style.removeProperty('cursor')
  document.body.style.removeProperty('user-select')
  window.removeEventListener('mousemove', onResizeMove)
  window.removeEventListener('mouseup', onResizeEnd)
  persistLarguras()
}

function iniciarResize(colId: ColId, e: MouseEvent) {
  if (colId === 'sel') return
  e.preventDefault()
  e.stopPropagation()
  resizeState = {
    colId,
    startX: e.clientX,
    startW: colWidths.value[colId] ?? DEFAULT_WIDTHS[colId],
  }
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  window.addEventListener('mousemove', onResizeMove)
  window.addEventListener('mouseup', onResizeEnd)
}

onUnmounted(() => {
  window.removeEventListener('mousemove', onResizeMove)
  window.removeEventListener('mouseup', onResizeEnd)
  document.body.style.removeProperty('cursor')
  document.body.style.removeProperty('user-select')
})

const props = withDefaults(
  defineProps<{
    /** Só necessário em `modo="rascunho"`; listagem API usa a Pinia. */
    items?: ProdutoWorkspaceItem[]
    /** Obrigatório para gravar alterações na API. */
    workspaceId?: number | null
    /** `api` (padrão): edita e salva via endpoints. `rascunho`: edita localmente e emite `atualizado`. */
    modo?: 'api' | 'rascunho'
    /** Page size atual da listagem (para o seletor de linhas). */
    pageSize?: number
    /** Mostra seletor de Quer exibir quantos produtos na tabela?. */
    mostrarLimiteLinhas?: boolean
    /** Mostra coluna de seleção e ações em massa. */
    mostrarSelecao?: boolean
    /** Mostra barra e ação de excluir selecionados (só `modo=api`). */
    mostrarExclusao?: boolean
    /** Força render da tabela mesmo sem itens (útil para modais/rascunho). */
    forcarTabelaVazia?: boolean
    /** Mostra botão de imagem na coluna PRODUTO. */
    mostrarImagens?: boolean
    /** Enter numa célula salta para a linha abaixo (mesma coluna); na última linha cria nova (só `modo="rascunho"`). */
    enterAdicionaLinha?: boolean
    pending?: boolean
    error?: string | null
    /** Total de produtos (toolbar estilo Notion). */
    total?: number
  }>(),
  {
    workspaceId: null,
    modo: 'api',
    pageSize: 10,
    mostrarLimiteLinhas: true,
    mostrarSelecao: true,
    mostrarExclusao: true,
    forcarTabelaVazia: false,
    mostrarImagens: true,
    enterAdicionaLinha: false,
    pending: false,
    error: null,
    items: () => [],
  },
)

const emit = defineEmits<{
  atualizado: [row: ProdutoWorkspaceItem]
  'adicionar-linha': []
  'erro-salvamento': []
  /** Após exclusão em massa bem-sucedida; o pai deve recarregar a listagem. */
  eliminados: []
  /** Após criar variação; o pai deve recarregar a listagem. */
  'variacao-criada': []
  /** Quando o user muda o tamanho da página (10/50/100/1000). */
  'page-size-changed': [pageSize: number]
}>()

const excluindo = ref(false)
const progressoExclusaoAberto = ref(false)
const progressoExclusaoTotal = ref(0)
const progressoExclusaoProcessados = ref(0)
const progressoExclusaoErro = ref<string | null>(null)
const rotulosExclusao = ref<string[]>([])
let abortExclusao: AbortController | null = null

type EstadoCelulaSalvamento = 'pending' | 'error'
/** `${produtoId}:${campo}` — permite editar outras linhas enquanto uma célula grava. */
const celulaSalvamento = ref<Record<string, EstadoCelulaSalvamento>>({})
/** Evita que um PATCH antigo sobrescreva um valor já alterado de novo pelo user. */
const celulaPatchGeracao = new Map<string, number>()
const celulaErroTimers = new Map<string, ReturnType<typeof setTimeout>>()

function cellKeySalvamento(produtoId: number, campo: string): string {
  return `${produtoId}:${campo}`
}

function bumpGeracaoCelulas(produtoId: number, campos: string[]): Map<string, number> {
  const geracoes = new Map<string, number>()
  for (const campo of campos) {
    const k = cellKeySalvamento(produtoId, campo)
    const next = (celulaPatchGeracao.get(k) ?? 0) + 1
    celulaPatchGeracao.set(k, next)
    geracoes.set(k, next)
  }
  return geracoes
}

function geracaoAindaValida(produtoId: number, campos: string[], geracoes: Map<string, number>): boolean {
  return campos.every((campo) => {
    const k = cellKeySalvamento(produtoId, campo)
    return celulaPatchGeracao.get(k) === geracoes.get(k)
  })
}

function estadoCelula(produtoId: number, campo: string): EstadoCelulaSalvamento | null {
  return celulaSalvamento.value[cellKeySalvamento(produtoId, campo)] ?? null
}

function marcarCelulas(produtoId: number, campos: string[], estado: EstadoCelulaSalvamento | null) {
  const next = { ...celulaSalvamento.value }
  for (const campo of campos) {
    const k = cellKeySalvamento(produtoId, campo)
    if (estado == null) delete next[k]
    else next[k] = estado
  }
  celulaSalvamento.value = next
}

function flashErroCelulas(produtoId: number, campos: string[]) {
  marcarCelulas(produtoId, campos, 'error')
  for (const campo of campos) {
    const k = cellKeySalvamento(produtoId, campo)
    const prev = celulaErroTimers.get(k)
    if (prev) clearTimeout(prev)
    celulaErroTimers.set(
      k,
      setTimeout(() => {
        marcarCelulas(produtoId, [campo], null)
        celulaErroTimers.delete(k)
      }, 3500),
    )
  }
}

function classesCelula(produtoId: number, campo: string, base: string): string {
  const st = estadoCelula(produtoId, campo)
  if (st === 'error') {
    return `${base} !bg-red-50/80 ring-1 ring-inset ring-red-400/60 dark:!bg-red-950/35 dark:ring-red-500/50`
  }
  return base
}

function classesInput(produtoId: number, campo: string, base: string): string {
  const st = estadoCelula(produtoId, campo)
  if (st === 'error') {
    return `${base} text-red-700 dark:text-red-400`
  }
  return base
}

function clonarLinhaParaSalvar(row: ProdutoWorkspaceCampos): ProdutoWorkspaceCampos {
  return {
    ...row,
    termos_pesquisa: [...(row.termos_pesquisa ?? [])],
    imagens: [...(row.imagens ?? [])],
  }
}

function patchOtimista(row: ProdutoWorkspaceCampos, patch: ProdutoWorkspacePatch): Record<string, unknown> {
  const extra: Record<string, unknown> = { ...patch }
  const wid = props.workspaceId
  if (wid != null && wid >= 1 && patch.categoria_id !== undefined) {
    if (patch.categoria_id == null) {
      extra.categoria_nome = null
    } else {
      const cat = useProdutoCategoriasStore()
        .getListaCompletaCopia(wid)
        .find((c) => c.id === patch.categoria_id)
      extra.categoria_nome = cat?.nome ?? row.categoria_nome
    }
  }
  if (wid != null && wid >= 1 && patch.termos_pesquisa_ids !== undefined) {
    const ids = patch.termos_pesquisa_ids ?? []
    if (!ids.length) {
      extra.termos_pesquisa = []
      extra.termos_pesquisa_busca = null
    } else {
      const lista = useProdutoTermosPesquisaStore().getListaCompletaCopia(wid)
      extra.termos_pesquisa = ids
        .map((id) => lista.find((t) => t.id === id))
        .filter((t): t is NonNullable<typeof t> => t != null)
      extra.termos_pesquisa_busca = (extra.termos_pesquisa as { nome: string }[])[0]?.nome ?? row.termos_pesquisa_busca
    }
  }
  return extra
}

function emitLinhaLocal(row: ProdutoWorkspaceCampos, patch: ProdutoWorkspacePatch = {}) {
  const extra = patchOtimista(row, patch)
  const pai = itemsPinia.value.find((p) => p.id === row.id)
  const isVariacao = row.parent_id != null && row.parent_id > 0

  if (props.modo === 'rascunho') {
    emit('atualizado', { ...row, ...extra, parent_id: null, tem_variacoes: false, variacoes: [] } as ProdutoWorkspaceItem)
    return
  }

  if (isVariacao) {
    emit('atualizado', {
      ...row,
      ...extra,
      parent_id: row.parent_id!,
      tem_variacoes: false,
      variacoes: [],
    } as unknown as ProdutoWorkspaceItem)
    return
  }

  emit('atualizado', {
    ...row,
    ...extra,
    parent_id: null,
    tem_variacoes: pai?.tem_variacoes ?? false,
    variacoes: pai?.variacoes ?? [],
  } as ProdutoWorkspaceItem)
}

function camposDoPatch(patch: ProdutoWorkspacePatch): string[] {
  return Object.keys(patch) as string[]
}
const modalVariacaoAberto = ref(false)
const paiVariacaoAlvo = ref<ProdutoWorkspaceItem | null>(null)
const salvandoVariacao = ref(false)
/** Ids selecionados (podem abranger várias páginas). */
const selecionadosIds = ref<number[]>([])

const idsNaPagina = computed(() => itemsExibicao.value.map((r) => r.id))

const todosDaPaginaSelecionados = computed(
  () =>
    itemsExibicao.value.length > 0 &&
    itemsExibicao.value.every((r) => selecionadosIds.value.includes(r.id)),
)

const indeterminadoCabecalhoPagina = computed(() => {
  const pag = idsNaPagina.value
  if (!pag.length) return false
  const n = pag.filter((id) => selecionadosIds.value.includes(id)).length
  return n > 0 && n < pag.length
})

function alternarSelecionado(id: number, checked: boolean) {
  const s = new Set(selecionadosIds.value)
  if (checked) s.add(id)
  else s.delete(id)
  selecionadosIds.value = [...s]
}

function alternarSelecionarTodosNaPagina(checked: boolean) {
  const s = new Set(selecionadosIds.value)
  for (const id of idsNaPagina.value) {
    if (checked) s.add(id)
    else s.delete(id)
  }
  selecionadosIds.value = [...s]
}

function mapaNomesProdutosVisiveis(): Map<number, string> {
  const mapa = new Map<number, string>()
  for (const pai of itemsPinia.value) {
    mapa.set(pai.id, pai.nome)
    for (const v of pai.variacoes ?? []) mapa.set(v.id, v.nome)
  }
  return mapa
}

function rotulosDosIds(ids: number[]): string[] {
  const mapa = mapaNomesProdutosVisiveis()
  return ids.map((id) => mapa.get(id) ?? `Produto #${id}`)
}

function cancelarExclusao() {
  abortExclusao?.abort()
}

async function excluirSelecionados() {
  if (props.modo === 'rascunho') return
  const wid = props.workspaceId
  if (wid == null || wid < 1) return
  const ids = [...new Set(selecionadosIds.value)]
  if (!ids.length) return
  const msg =
    ids.length === 1
      ? 'Eliminar este produto? Esta ação não pode ser anulada.'
      : `Eliminar ${ids.length} produtos? Esta ação não pode ser anulada.`
  if (!window.confirm(msg)) return

  progressoExclusaoTotal.value = ids.length
  progressoExclusaoProcessados.value = 0
  progressoExclusaoErro.value = null
  rotulosExclusao.value = rotulosDosIds(ids)
  progressoExclusaoAberto.value = true
  excluindo.value = true
  abortExclusao = new AbortController()
  const signal = abortExclusao.signal

  // Otimista: some da UI primeiro; se a API falhar, restaura com marcação vermelha.
  const snapshot = produtosStore.removerProdutosOtimista(ids)
  selecionadosIds.value = []

  let totalRemovidos = 0
  let cancelado = false

  try {
    for (let i = 0; i < ids.length; i += CHUNK_EXCLUIR_PRODUTOS) {
      if (signal.aborted) {
        cancelado = true
        break
      }
      const chunk = ids.slice(i, i + CHUNK_EXCLUIR_PRODUTOS)
      const res = await $fetch<ProdutosExcluirResponse>('/api/produtos/enviar-para-ia/excluir', {
        method: 'POST',
        body: { workspace_id: wid, ids: chunk },
        signal,
      })
      totalRemovidos += res.removidos ?? 0
      progressoExclusaoProcessados.value = Math.min(i + chunk.length, ids.length)
    }

    if (cancelado) {
      toast.info('Eliminação cancelada.')
      // Re-sincroniza a listagem: parte pode já ter sido apagada no servidor.
      emit('eliminados')
      progressoExclusaoAberto.value = false
    } else {
      progressoExclusaoAberto.value = false
      if (totalRemovidos <= 0) {
        toast.info('Nenhum produto foi eliminado (ids podem já não existir).')
      } else if (totalRemovidos === 1) {
        toast.success('1 produto eliminado.')
      } else {
        toast.success(`${totalRemovidos} produtos eliminados.`)
      }
    }
  } catch (err: unknown) {
    const e = err as { name?: string }
    if (e?.name === 'AbortError') {
      toast.info('Eliminação cancelada.')
      emit('eliminados')
      progressoExclusaoAberto.value = false
    } else if (progressoExclusaoProcessados.value > 0) {
      // Parte já foi apagada no servidor — recarrega para sincronizar.
      progressoExclusaoErro.value = mensagemErroFetch(err, 'Não foi possível eliminar os produtos.')
      emit('eliminados')
    } else {
      produtosStore.restaurarProdutosOtimista(snapshot)
      for (const id of snapshot.idsAfetados) {
        flashErroCelulas(id, ['nome'])
      }
      selecionadosIds.value = [...snapshot.idsAfetados]
      progressoExclusaoAberto.value = false
      toast.error(mensagemErroFetch(err, 'Não foi possível eliminar os produtos.'))
    }
  } finally {
    excluindo.value = false
    abortExclusao = null
  }
}

function fecharModalExclusao() {
  if (excluindo.value) {
    cancelarExclusao()
    return
  }
  progressoExclusaoAberto.value = false
  progressoExclusaoErro.value = null
}

function podeGravar(): boolean {
  if (props.modo === 'rascunho') return true
  const w = props.workspaceId
  return w != null && Number.isFinite(w) && w >= 1
}

const opcoesPageSize = [10, 50, 100, 1000] as const

/** Altura fixa da área rolável ≈ cabeçalho + 10 linhas (independente do page_size). */
const ALTURA_CABECALHO_TABELA_PX = 36
const ALTURA_LINHA_ESTIMADA_PX = 44
const LINHAS_VIEWPORT_SCROLL = 10
const alturaMaxScrollTabelaPx =
  ALTURA_CABECALHO_TABELA_PX + LINHAS_VIEWPORT_SCROLL * ALTURA_LINHA_ESTIMADA_PX

function onMudarPageSize(ev: Event) {
  const raw = (ev.target as HTMLSelectElement).value
  const n = Number.parseInt(String(raw), 10)
  if (!Number.isFinite(n) || n < 1) return
  emit('page-size-changed', n)
}

watch(
  () => props.workspaceId,
  () => {
    selecionadosIds.value = []
    expandedParentIds.value = new Set()
  },
)

function resetarEstadoPosImportacao() {
  selecionadosIds.value = []
  expandedParentIds.value = new Set()
}

/**
 * Em modo rascunho, o input é one-way (`:value`); o Pinia só atualiza no blur.
 * Antes de salvar, força sincronizar o que ainda está digitado no DOM.
 */
function sincronizarInputsRascunho() {
  if (props.modo !== 'rascunho') return
  const root = tabelaScrollRef.value
  if (!root) return

  for (const input of root.querySelectorAll<HTMLInputElement>('[data-campo-produto="nome"]')) {
    const tr = input.closest('tr')
    const id = Number(tr?.dataset.linhaProdutoId)
    if (!Number.isFinite(id)) continue
    const row = itemsExibicao.value.find((p) => p.id === id)
    if (!row) continue
    const v = input.value.trim()
    if (!v || v === String(row.nome ?? '').trim()) continue
    emitLinhaLocal(row, { nome: v })
  }
}

defineExpose({ resetarEstadoPosImportacao, focarNomeUltimaLinha, sincronizarInputsRascunho })

watch(
  itemsExibicao,
  () => {
    const idsPais = new Set(itemsExibicao.value.map((p) => p.id))
    const next = new Set<number>()
    for (const id of expandedParentIds.value) {
      if (idsPais.has(id)) next.add(id)
    }
    expandedParentIds.value = next
  },
)

type LinhaTabelaExibicao = {
  row: ProdutoWorkspaceCampos
  tipo: 'pai' | 'variacao'
  pai?: ProdutoWorkspaceItem
}

const expandedParentIds = ref<Set<number>>(new Set())

function estaExpandido(parentId: number): boolean {
  return expandedParentIds.value.has(parentId)
}

function toggleExpandir(parentId: number) {
  const next = new Set(expandedParentIds.value)
  if (next.has(parentId)) next.delete(parentId)
  else next.add(parentId)
  expandedParentIds.value = next
}

function expandirPai(parentId: number) {
  const next = new Set(expandedParentIds.value)
  next.add(parentId)
  expandedParentIds.value = next
}

function abrirModalNovaVariacao(pai: ProdutoWorkspaceItem) {
  if (props.modo !== 'api' || rowDesabilitada(pai)) return
  paiVariacaoAlvo.value = pai
  modalVariacaoAberto.value = true
}

async function confirmarNovaVariacao(nome: string) {
  const pai = paiVariacaoAlvo.value
  const wid = props.workspaceId
  if (!pai || wid == null || wid < 1) return
  salvandoVariacao.value = true
  try {
    await produtosStore.criarVariacaoProduto({
      workspaceId: wid,
      parentId: pai.id,
      nome,
    })
    expandirPai(pai.id)
    modalVariacaoAberto.value = false
    paiVariacaoAlvo.value = null
    emit('variacao-criada')
    toast.success('Variação criada.')
  } catch (err) {
    toast.error(mensagemErroFetch(err, 'Não foi possível criar a variação.'))
  } finally {
    salvandoVariacao.value = false
  }
}

function paiTemVariacoesVisiveis(pai: ProdutoWorkspaceItem): boolean {
  return props.modo === 'api' && pai.tem_variacoes && pai.variacoes.length > 0
}

function montarRefSelecionado(
  row: ProdutoWorkspaceCampos,
  tipo: 'pai' | 'variacao',
  pai?: ProdutoWorkspaceItem,
): ProdutoSelecionadoRef {
  const contexto = props.modo === 'rascunho' ? 'rascunho' : 'lista'
  return {
    produtoId: row.id,
    nome: row.nome,
    contexto,
    parentId: tipo === 'variacao' ? (pai?.id ?? row.parent_id ?? null) : null,
    tipo,
  }
}

function abrirGaleriaImagens(
  row: ProdutoWorkspaceCampos,
  tipo: 'pai' | 'variacao',
  pai?: ProdutoWorkspaceItem,
) {
  if (rowDesabilitada(row) && props.modo === 'api') return
  let imagens = [...(row.imagens ?? [])]
  const legado = row.imagem_url?.trim()
  if (!imagens.length && legado) {
    imagens = [{ url: legado, ordem: 0, produto_id: row.id }]
  }
  produtosStore.abrirModalImagens({
    ref: montarRefSelecionado(row, tipo, pai),
    imagens,
  })
}

function contagemImagensLinha(row: ProdutoWorkspaceCampos): number {
  const n = row.imagens?.length ?? 0
  if (n > 0) return n
  return row.imagem_url?.trim() ? 1 : 0
}

function urlImagemLinha(row: ProdutoWorkspaceCampos): string | null {
  const daGaleria = produtosStore.urlImagemPrincipal(row.imagens ?? [])
  if (daGaleria) return daGaleria
  const u = row.imagem_url?.trim()
  return u ? u : null
}

function resumoVariacao(row: ProdutoWorkspaceCampos): string {
  const sku = row.sku?.trim()
  const attrs = row.atributos
  if (attrs && typeof attrs === 'object' && !Array.isArray(attrs)) {
    const partes = Object.entries(attrs)
      .filter(([, v]) => v != null && String(v).trim() !== '')
      .slice(0, 4)
      .map(([k, v]) => `${k}: ${v}`)
    if (partes.length) return partes.join(' · ')
  }
  return sku ? `SKU: ${sku}` : ''
}

const linhasExibicao = computed<LinhaTabelaExibicao[]>(() => {
  const out: LinhaTabelaExibicao[] = []
  for (const pai of itemsExibicao.value) {
    out.push({ row: pai, tipo: 'pai', pai })
    if (paiTemVariacoesVisiveis(pai) && estaExpandido(pai.id)) {
      for (const v of pai.variacoes) {
        out.push({ row: v, tipo: 'variacao', pai })
      }
    }
  }
  return out
})

function gravarPatch(row: ProdutoWorkspaceCampos, patch: ProdutoWorkspacePatch) {
  if (props.modo === 'rascunho') {
    emitLinhaLocal(row, patch)
    return
  }
  if (!podeGravar()) return
  const campos = camposDoPatch(patch)
  if (!campos.length) return

  // 1) Pinia primeiro — UI livre para editar várias células em paralelo.
  const rowAntes = clonarLinhaParaSalvar(row)
  emitLinhaLocal(row, patch)
  const geracoes = bumpGeracaoCelulas(row.id, campos)
  // Sem estado "pending" (não trava/opaca a célula).
  marcarCelulas(row.id, campos, null)

  const produtoId = row.id

  void $fetch<ProdutoAtualizarResponse>('/api/produtos/atualizar', {
    method: 'PATCH',
    body: {
      workspace_id: props.workspaceId,
      id: produtoId,
      patch,
    },
  })
    .then(() => {
      if (!geracaoAindaValida(produtoId, campos, geracoes)) return
      // Sucesso: valor otimista já está no Pinia; não reaplica a linha inteira.
      marcarCelulas(produtoId, campos, null)
    })
    .catch((err: unknown) => {
      if (!geracaoAindaValida(produtoId, campos, geracoes)) return

      const atual =
        itemsPinia.value.find((p) => p.id === produtoId) ??
        itemsPinia.value.flatMap((p) => p.variacoes ?? []).find((v) => v.id === produtoId) ??
        rowAntes

      const revert: Record<string, unknown> = {}
      const antes = rowAntes as Record<string, unknown>
      for (const c of campos) {
        if (c in antes) revert[c] = antes[c]
      }
      emitLinhaLocal(atual as ProdutoWorkspaceCampos, revert as ProdutoWorkspacePatch)
      flashErroCelulas(produtoId, campos)
      toast.error(mensagemErroFetch(err, 'Não foi possível guardar a alteração.'), { duration: 5000 })
    })
}

function focarCampoNaLinha(tr: Element, campo: string) {
  const input = tr.querySelector(`[data-campo-produto="${campo}"]`) as HTMLInputElement | null
  if (!input || input.disabled) return
  input.focus()
  input.select()
}

async function focarNomeUltimaLinha() {
  await nextTick()
  const root = tabelaScrollRef.value
  if (!root) return
  const rows = Array.from(root.querySelectorAll<HTMLElement>('tbody tr[data-linha-produto-id]'))
  const last = rows[rows.length - 1]
  if (last) focarCampoNaLinha(last, 'nome')
}

async function onEnterCelula(ev: Event) {
  const t = ev.target as HTMLInputElement | HTMLTextAreaElement
  const campo = t.dataset.campoProduto
  const linhaId = t.closest('tr')?.dataset.linhaProdutoId

  t.blur()

  if (!props.enterAdicionaLinha || props.modo !== 'rascunho' || !campo) return

  const root = tabelaScrollRef.value
  if (!root) return

  const rows = Array.from(root.querySelectorAll<HTMLElement>('tbody tr[data-linha-produto-id]'))
  const currentIndex = linhaId
    ? rows.findIndex((r) => r.dataset.linhaProdutoId === linhaId)
    : -1

  const nextRow = currentIndex >= 0 && currentIndex + 1 < rows.length ? rows[currentIndex + 1] : null
  if (nextRow) {
    focarCampoNaLinha(nextRow, campo)
    return
  }

  emit('adicionar-linha')
  await nextTick()
  const updatedRows = Array.from(root.querySelectorAll<HTMLElement>('tbody tr[data-linha-produto-id]'))
  const last = updatedRows[updatedRows.length - 1]
  if (last) focarCampoNaLinha(last, campo)
}

/** Clicar em qualquer área da célula abre o campo para edição (estilo Notion). */
function focusarInputCelula(ev: MouseEvent) {
  const el = ev.currentTarget as HTMLElement
  const input = el.querySelector('input:not(.sr-only), textarea') as HTMLInputElement | null
  if (!input || input.disabled) return
  if (document.activeElement === input) return
  input.focus()
  input.select()
}

function fmtPrecoInput(n: number): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

/** Célula de preço: vazio quando null ou 0 (sem valor predefinido "0,00"). */
function fmtPrecoCelula(val: number | null | undefined): string {
  if (val == null || val === 0) return ''
  return fmtPrecoInput(val)
}

function eqNum(a: number | null | undefined, b: number | null | undefined): boolean {
  if (a == null && b == null) return true
  if (a == null || b == null) return false
  return Math.abs(a - b) < 1e-9
}

function blurNome(row: ProdutoWorkspaceCampos, ev: Event) {
  const v = (ev.target as HTMLInputElement).value.trim()
  if (!v) {
    toast.error('O nome não pode ser vazio.')
    return
  }
  if (v === row.nome.trim()) return
  void gravarPatch(row, { nome: v })
}

function blurUnidade(row: ProdutoWorkspaceCampos, ev: Event) {
  const v = (ev.target as HTMLInputElement).value.trim()
  const atual = (row.unidade_venda ?? '').trim()
  if (v === atual) return
  void gravarPatch(row, { unidade_venda: v.length ? v : null })
}

function blurMarca(row: ProdutoWorkspaceCampos, ev: Event) {
  const v = (ev.target as HTMLInputElement).value.trim()
  const atual = (row.marca ?? '').trim()
  if (v === atual) return
  void gravarPatch(row, { marca: v.length ? v : null })
}

function blurEstoque(row: ProdutoWorkspaceCampos, ev: Event) {
  const raw = (ev.target as HTMLInputElement).value.trim()
  if (!raw.length) {
    if (row.estoque == null) return
    void gravarPatch(row, { estoque: null })
    return
  }
  const n = parseDecimalPtBr(raw)
  if (n == null || n < 0) {
    toast.error('Estoque inválido.')
    return
  }
  if (eqNum(n, row.estoque)) return
  void gravarPatch(row, { estoque: n })
}

function blurPreco(row: ProdutoWorkspaceCampos, ev: Event) {
  const raw = (ev.target as HTMLInputElement).value.trim()
  if (!raw.length) {
    if (row.preco == null || row.preco === 0) return
    void gravarPatch(row, { preco: 0 })
    return
  }
  const n = parseDecimalPtBr(raw)
  if (n == null) {
    toast.error('Preço inválido.')
    return
  }
  if (n < 0) {
    toast.error('O preço não pode ser negativo.')
    return
  }
  if (eqNum(n, row.preco)) return
  void gravarPatch(row, { preco: n })
}

function blurPrecoCusto(row: ProdutoWorkspaceCampos, ev: Event) {
  const raw = (ev.target as HTMLInputElement).value.trim()
  if (!raw.length) {
    if (row.preco_custo == null || row.preco_custo === 0) return
    void gravarPatch(row, { preco_custo: 0 })
    return
  }
  const n = parseDecimalPtBr(raw)
  if (n == null || n < 0) {
    toast.error('Preço de custo inválido.')
    return
  }
  if (eqNum(n, row.preco_custo)) return
  void gravarPatch(row, { preco_custo: n })
}

function blurPrecoPrazo(row: ProdutoWorkspaceCampos, ev: Event) {
  const raw = (ev.target as HTMLInputElement).value.trim()
  if (!raw.length) {
    if (row.preco_prazo == null || row.preco_prazo === 0) return
    void gravarPatch(row, { preco_prazo: null })
    return
  }
  const n = parseDecimalPtBr(raw)
  if (n == null || n < 0) {
    toast.error('Preço a prazo inválido.')
    return
  }
  if (eqNum(n, row.preco_prazo)) return
  void gravarPatch(row, { preco_prazo: n })
}

function blurPrecoPromocional(row: ProdutoWorkspaceCampos, ev: Event) {
  const raw = (ev.target as HTMLInputElement).value.trim()
  if (!raw.length) {
    if (row.preco_promocional == null || row.preco_promocional === 0) return
    void gravarPatch(row, { preco_promocional: null })
    return
  }
  const n = parseDecimalPtBr(raw)
  if (n == null || n < 0) {
    toast.error('Preço promocional inválido.')
    return
  }
  if (eqNum(n, row.preco_promocional)) return
  void gravarPatch(row, { preco_promocional: n })
}

function blurPeso(row: ProdutoWorkspaceCampos, ev: Event) {
  const raw = (ev.target as HTMLInputElement).value.trim()
  if (!raw.length) {
    if (row.peso_kg == null) return
    void gravarPatch(row, { peso_kg: null })
    return
  }
  const n = parseDecimalPtBr(raw)
  if (n == null || n < 0) {
    toast.error('Peso inválido.')
    return
  }
  if (eqNum(n, row.peso_kg)) return
  void gravarPatch(row, { peso_kg: n })
}

function blurCodigo(row: ProdutoWorkspaceCampos, ev: Event) {
  const raw = (ev.target as HTMLInputElement).value.trim()
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 1) {
    toast.error('Informe um código inteiro ≥ 1.')
    return
  }
  if (n === row.codigo) return
  void gravarPatch(row, { codigo: n })
}

function blurSku(row: ProdutoWorkspaceCampos, ev: Event) {
  const v = (ev.target as HTMLInputElement).value.trim()
  const atual = (row.sku ?? '').trim()
  if (v === atual) return
  void gravarPatch(row, { sku: v.length ? v : null })
}

function blurCodigoNcm(row: ProdutoWorkspaceCampos, ev: Event) {
  const v = (ev.target as HTMLInputElement).value.trim()
  const atual = (row.codigo_ncm ?? '').trim()
  if (v === atual) return
  void gravarPatch(row, { codigo_ncm: v.length ? v : null })
}

function blurCodigoBarras(row: ProdutoWorkspaceCampos, ev: Event) {
  const v = (ev.target as HTMLInputElement).value.trim()
  const atual = (row.codigo_barras_ean ?? '').trim()
  if (v === atual) return
  void gravarPatch(row, { codigo_barras_ean: v.length ? v : null })
}

function commitCatalogo(row: ProdutoWorkspaceCampos, patch: ProdutoWorkspacePatch) {
  void gravarPatch(row, patch)
}

function blurDimensao(row: ProdutoWorkspaceCampos, campo: 'largura' | 'altura' | 'comprimento', ev: Event) {
  const raw = (ev.target as HTMLInputElement).value.trim()
  const n = raw.length === 0 ? 0 : (parseDecimalPtBr(raw) ?? null)
  if (n == null || n < 0) {
    toast.error('Dimensão inválida.')
    return
  }
  const atual = row[campo]
  if (eqNum(n, atual)) return
  void gravarPatch(row, { [campo]: n } as any)
}

function blurInfos(row: ProdutoWorkspaceCampos, ev: Event) {
  const v = (ev.target as HTMLInputElement).value.trim()
  const atual = (row.infos_relevantes ?? '').trim()
  if (v === atual) return
  void gravarPatch(row, { infos_relevantes: v.length ? v : null })
}

function alternarStatus(row: ProdutoWorkspaceCampos) {
  void gravarPatch(row, { status: !row.status })
}

function rowDesabilitada(row: ProdutoWorkspaceCampos): boolean {
  if (props.modo === 'rascunho') return false
  return !podeGravar() || excluindo.value
}

onUnmounted(() => {
  for (const t of celulaErroTimers.values()) clearTimeout(t)
  celulaErroTimers.clear()
})
</script>

<template>
  <div
    class="w-full min-w-0 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
  >
    <div
      v-if="mostrarLimiteLinhas"
      class="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <p class="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        Produtos
        <span v-if="total != null && total >= 0" class="font-normal text-zinc-500 dark:text-zinc-400">
          ({{ total.toLocaleString('pt-BR') }})
        </span>
      </p>
      <div class="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
        <span class="hidden sm:inline">Quer exibir quantos produtos na tabela?</span>
        <select
          class="rounded-lg border border-zinc-200 bg-transparent px-2.5 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus:border-zinc-300 focus:outline-none dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          :value="pageSize"
          :disabled="pending"
          aria-label="Selecionar Quer exibir quantos produtos na tabela?"
          @change="onMudarPageSize"
        >
          <option v-for="n in opcoesPageSize" :key="n" :value="n">{{ n }}</option>
        </select>
      </div>
    </div>

    <div v-if="error" class="border-b border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
      {{ error }}
    </div>

    <div
      v-else-if="!pending && itemsExibicao.length === 0 && !forcarTabelaVazia"
      class="m-6 rounded-xl border border-dashed border-zinc-200 py-12 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"
    >
      Nenhum produto encontrado.
    </div>

    <div v-else class="w-full min-w-0 max-w-full">
      <p
        v-if="!podeGravar()"
        class="border-b border-amber-200/80 bg-amber-50/90 px-4 py-2.5 text-xs text-amber-950 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-100"
      >
        Abra esta página dentro de um workspace para poder editar produtos.
      </p>

      <div
        v-if="mostrarSelecao && mostrarExclusao && modo === 'api' && selecionadosIds.length > 0 && podeGravar()"
        class="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/80"
      >
        <p class="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          <strong>{{ selecionadosIds.length }}</strong>
          <template v-if="selecionadosIds.length === 1"> produto selecionado</template>
          <template v-else> produtos selecionados</template>
        </p>
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-xl border border-red-400/80 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-900 shadow-sm transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-55 dark:border-red-700/70 dark:bg-red-950/45 dark:text-red-100 dark:hover:bg-red-950/65"
          :disabled="excluindo"
          @click="excluirSelecionados"
        >
          <span class="material-symbols-outlined text-[20px]" aria-hidden="true">delete</span>
          {{ excluindo ? 'A eliminar…' : 'Excluir selecionados' }}
        </button>
      </div>

      <div
        ref="tabelaScrollRef"
        class="w-full min-w-0 max-w-full overflow-auto"
        :style="modo === 'api' ? { maxHeight: `${alturaMaxScrollTabelaPx}px` } : undefined"
      >
      <table
        class="table-fixed border-collapse text-left"
        :style="{ width: larguraTabelaPx + 'px' }"
      >
        <colgroup>
          <col v-for="c in columns" :key="'cw-' + c.id" :style="{ width: colWidths[c.id] + 'px' }" />
        </colgroup>
        <thead class="sticky top-0 z-30 border-b border-zinc-200 dark:border-zinc-800">
          <tr>
            <th
              v-for="col in columns"
              :key="col.id"
              :class="[thClass, col.id === 'sel' ? thSelClass : '']"
            >
              <template v-if="col.id === 'sel'">
                <label
                  :class="[
                    checkboxCelulaLabelHeaderClass,
                    !mostrarSelecao || pending || !itemsExibicao.length || !podeGravar() || excluindo
                      ? 'cursor-not-allowed opacity-40'
                      : '',
                  ]"
                >
                  <span
                    :class="[
                      checkboxVisualBaseClass,
                      todosDaPaginaSelecionados || indeterminadoCabecalhoPagina
                        ? checkboxVisualMarcadoClass
                        : checkboxVisualOcultoClass,
                    ]"
                    aria-hidden="true"
                  >
                    <svg
                      v-if="indeterminadoCabecalhoPagina && !todosDaPaginaSelecionados"
                      class="h-3 w-3 text-white"
                      viewBox="0 0 12 12"
                      fill="none"
                    >
                      <path
                        d="M2.5 6h7"
                        stroke="currentColor"
                        stroke-width="1.75"
                        stroke-linecap="round"
                      />
                    </svg>
                    <svg
                      v-else-if="todosDaPaginaSelecionados"
                      class="h-3 w-3 text-white"
                      viewBox="0 0 12 12"
                      fill="none"
                    >
                      <path
                        d="M2.25 6.25L4.75 8.75L9.75 3.25"
                        stroke="currentColor"
                        stroke-width="1.75"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </svg>
                  </span>
                  <input
                    type="checkbox"
                    class="sr-only"
                    :checked="todosDaPaginaSelecionados"
                    :indeterminate="indeterminadoCabecalhoPagina"
                    :disabled="!mostrarSelecao || pending || !itemsExibicao.length || !podeGravar() || excluindo"
                    aria-label="Selecionar todos os produtos desta página"
                    @change="alternarSelecionarTodosNaPagina(($event.target as HTMLInputElement).checked)"
                  />
                </label>
              </template>
              <template v-else-if="col.id === 'produto'">
                <div class="flex min-w-0 items-center gap-1.5 pr-3">
                  <span
                    class="material-symbols-outlined shrink-0 text-[15px] text-zinc-400 dark:text-zinc-500"
                    aria-hidden="true"
                  >
                    title
                  </span>
                  <span class="min-w-0 truncate leading-snug">{{ col.label }}</span>
                </div>
                <span
                  class="absolute inset-y-0 right-0 z-20 w-2 cursor-col-resize select-none hover:bg-zinc-300/50 active:bg-zinc-400/50 dark:hover:bg-zinc-600/50"
                  role="separator"
                  :title="'Arrastar para ajustar a coluna «' + col.label + '»'"
                  aria-hidden="true"
                  @mousedown="iniciarResize(col.id, $event)"
                />
              </template>
              <!--
              <template v-else-if="col.id === 'categoria'">
                <div class="flex min-w-0 items-center gap-1.5 pr-3">
                  <span
                    class="material-symbols-outlined shrink-0 text-[15px] text-zinc-400 dark:text-zinc-500"
                    aria-hidden="true"
                  >
                    category
                  </span>
                  <span class="min-w-0 truncate leading-snug">{{ col.label }}</span>
                </div>
                <span
                  class="absolute inset-y-0 right-0 z-20 w-2 cursor-col-resize select-none hover:bg-zinc-300/50 active:bg-zinc-400/50 dark:hover:bg-zinc-600/50"
                  role="separator"
                  :title="'Arrastar para ajustar a coluna «' + col.label + '»'"
                  aria-hidden="true"
                  @mousedown="iniciarResize(col.id, $event)"
                />
              </template>
              -->
              <template v-else>
                <div class="flex min-w-0 items-center pr-3">
                  <span class="min-w-0 truncate leading-snug">{{ col.label }}</span>
                </div>
                <span
                  class="absolute inset-y-0 right-0 z-20 w-2 cursor-col-resize select-none hover:bg-zinc-300/50 active:bg-zinc-400/50 dark:hover:bg-zinc-600/50"
                  role="separator"
                  :title="'Arrastar para ajustar a coluna «' + col.label + '»'"
                  aria-hidden="true"
                  @mousedown="iniciarResize(col.id, $event)"
                />
              </template>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="pending">
            <td :colspan="columns.length" :class="[tdClass, 'py-12 text-center text-sm text-zinc-500 dark:text-zinc-400']">
              Carregando…
            </td>
          </tr>
          <template v-if="!pending">
            <tr
              v-for="{ row, tipo, pai } in linhasExibicao"
              :key="tipo + '-' + row.id"
              :data-linha-produto-id="row.id"
              :class="[
                trClassBase,
                tipo === 'variacao'
                  ? 'border-l-2 border-l-zinc-300 bg-zinc-50/70 dark:border-l-zinc-600 dark:bg-zinc-900/40'
                  : '',
                { 'pointer-events-none opacity-50': excluindo },
              ]"
            >
              <td :class="tdSelClass">
                <label
                  :class="[
                    checkboxCelulaLabelClass,
                    !mostrarSelecao || rowDesabilitada(row) ? 'cursor-not-allowed opacity-40' : '',
                  ]"
                  @click.stop
                >
                  <span
                    :class="[
                      checkboxVisualBaseClass,
                      selecionadosIds.includes(row.id)
                        ? checkboxVisualMarcadoClass
                        : checkboxVisualOcultoClass,
                    ]"
                    aria-hidden="true"
                  >
                    <svg
                      v-if="selecionadosIds.includes(row.id)"
                      class="h-3 w-3 text-white"
                      viewBox="0 0 12 12"
                      fill="none"
                    >
                      <path
                        d="M2.25 6.25L4.75 8.75L9.75 3.25"
                        stroke="currentColor"
                        stroke-width="1.75"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </svg>
                  </span>
                  <input
                    type="checkbox"
                    class="sr-only"
                    :checked="selecionadosIds.includes(row.id)"
                    :disabled="!mostrarSelecao || rowDesabilitada(row)"
                    :aria-label="'Selecionar produto ' + row.nome"
                    @change="alternarSelecionado(row.id, ($event.target as HTMLInputElement).checked)"
                  />
                </label>
              </td>
              <td :class="tdClass">
                <div
                  :class="[celulaLinhaClass, 'group/produto cursor-text gap-0.5 px-1 py-2']"
                  @click="focusarInputCelula"
                >
                  <button
                    v-if="tipo === 'pai' && pai && paiTemVariacoesVisiveis(pai)"
                    type="button"
                    class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-200/80 dark:text-zinc-400 dark:hover:bg-zinc-700"
                    :aria-expanded="estaExpandido(row.id)"
                    :aria-label="estaExpandido(row.id) ? 'Recolher variações' : 'Expandir variações'"
                    @click.stop="toggleExpandir(row.id)"
                  >
                    <span class="material-symbols-outlined text-[18px]" aria-hidden="true">
                      {{ estaExpandido(row.id) ? 'expand_more' : 'chevron_right' }}
                    </span>
                  </button>
                  <span
                    v-else-if="tipo === 'variacao'"
                    class="material-symbols-outlined w-6 shrink-0 text-center text-[16px] text-zinc-400 dark:text-zinc-500"
                    aria-hidden="true"
                  >
                    subdirectory_arrow_right
                  </span>
                  <span v-else class="w-6 shrink-0" aria-hidden="true" />
                  <button
                    v-if="mostrarImagens"
                    type="button"
                    :class="iconImagemProdutoClass"
                    :disabled="rowDesabilitada(row)"
                    :aria-label="'Gerir imagens de ' + row.nome"
                    :title="contagemImagensLinha(row) === 0 ? 'Adicionar imagem' : contagemImagensLinha(row) + ' foto(s)'"
                    @click.stop="abrirGaleriaImagens(row, tipo, pai)"
                  >
                    <img
                      v-if="urlImagemLinha(row)"
                      :src="urlImagemLinha(row)!"
                      alt=""
                      class="h-full w-full object-cover"
                      loading="lazy"
                    />
                    <span
                      v-else
                      class="material-symbols-outlined text-[16px]"
                      aria-hidden="true"
                    >
                      photo
                    </span>
                    <span
                      v-if="contagemImagensLinha(row) > 1"
                      class="absolute -bottom-0.5 -right-0.5 flex h-3 min-w-3 items-center justify-center rounded-full bg-zinc-700 px-0.5 text-[7px] font-bold leading-none text-white dark:bg-zinc-300 dark:text-zinc-900"
                    >
                      {{ contagemImagensLinha(row) }}
                    </span>
                  </button>
                  <div class="min-w-0 flex flex-1 items-center gap-1 pr-2">
                    <div class="min-w-0 flex-1">
                      <p
                        v-if="tipo === 'variacao' && resumoVariacao(row)"
                        class="truncate text-[10px] font-medium leading-tight text-zinc-500 dark:text-zinc-400"
                      >
                        {{ resumoVariacao(row) }}
                      </p>
                      <input
                        type="text"
                        autocomplete="off"
                        data-campo-produto="nome"
                        :class="classesInput(row.id, 'nome', tipo === 'pai' ? inpClassProduto : inpClass)"
                        :value="row.nome"
                        :disabled="rowDesabilitada(row)"
                        :title="row.nome"
                        @keydown.enter.prevent="onEnterCelula"
                        @blur="blurNome(row, $event)"
                      />
                    </div>
                    <span
                      v-if="tipo === 'pai' && pai && paiTemVariacoesVisiveis(pai)"
                      class="shrink-0 text-[10px] tabular-nums text-zinc-400 dark:text-zinc-500"
                    >
                      {{ pai.variacoes.length }}
                    </span>
                    <button
                      v-if="tipo === 'pai' && modo === 'api'"
                      type="button"
                      class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-zinc-400 opacity-0 transition-all hover:bg-emerald-100/90 hover:text-emerald-700 focus-visible:opacity-100 group-hover/produto:opacity-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-500 dark:hover:bg-emerald-950/50 dark:hover:text-emerald-400"
                      :disabled="rowDesabilitada(row) || salvandoVariacao"
                      title="Adicionar variação"
                      aria-label="Adicionar variação de produto"
                      @click.stop="abrirModalNovaVariacao(pai ?? (row as ProdutoWorkspaceItem))"
                    >
                      <span class="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
                    </button>
                  </div>
                </div>
              </td>
              <!--
              <td :class="tdClass">
                <div :class="classesCelula(row.id, 'categoria_id', 'min-h-[2.75rem] w-full')">
                  <ProdutosSelecaoUnica
                    variant="celula"
                    :workspace-id="workspaceId"
                    :produto-id="row.id"
                    :categoria-id="row.categoria_id"
                    :categoria-nome="row.categoria_nome"
                    :disabled="rowDesabilitada(row)"
                    @commit="commitCatalogo(row, $event)"
                  />
                </div>
              </td>
              -->
              <td :class="tdClass">
                <div :class="classesCelula(row.id, 'termos_pesquisa_ids', celulaInnerClass)">
                  <ProdutosSelecaoUnica
                    catalogo="termos_pesquisa"
                    variant="celula"
                    :workspace-id="workspaceId"
                    :produto-id="row.id"
                    :termo-id="row.termos_pesquisa?.[0]?.id ?? null"
                    :termo-nome="row.termos_pesquisa?.[0]?.nome ?? row.termos_pesquisa_busca ?? null"
                    :disabled="rowDesabilitada(row)"
                    @commit="commitCatalogo(row, $event)"
                  />
                </div>
              </td>
              <td :class="tdClass">
                <div :class="classesCelula(row.id, 'unidade_venda', celulaInnerClass)" @click="focusarInputCelula">
                <input
                  type="text"
                  autocomplete="off"
                  data-campo-produto="unidade_venda"
                  :class="classesInput(row.id, 'unidade_venda', inpClass)"
                  :value="row.unidade_venda ?? ''"
                  :disabled="rowDesabilitada(row)"
                  @keydown.enter.prevent="onEnterCelula"
                  @blur="blurUnidade(row, $event)"
                />
                </div>
              </td>
              <td :class="tdClass">
                <div :class="classesCelula(row.id, 'marca', celulaInnerClass)" @click="focusarInputCelula">
                <input
                  type="text"
                  autocomplete="off"
                  data-campo-produto="marca"
                  :class="classesInput(row.id, 'marca', inpClass)"
                  :value="row.marca ?? ''"
                  :disabled="rowDesabilitada(row)"
                  placeholder="Marca"
                  @keydown.enter.prevent="onEnterCelula"
                  @blur="blurMarca(row, $event)"
                />
                </div>
              </td>
              <td :class="tdClass">
                <div :class="classesCelula(row.id, 'preco_custo', celulaInnerClass)" @click="focusarInputCelula">
                <input
                  type="text"
                  inputmode="decimal"
                  autocomplete="off"
                  data-campo-produto="preco_custo"
                  :class="classesInput(row.id, 'preco_custo', inpClass)"
                  :value="fmtPrecoCelula(row.preco_custo)"
                  :disabled="rowDesabilitada(row)"
                  @keydown.enter.prevent="onEnterCelula"
                  @blur="blurPrecoCusto(row, $event)"
                />
                </div>
              </td>
              <td :class="tdClass">
                <div :class="classesCelula(row.id, 'preco', celulaInnerClass)" @click="focusarInputCelula">
                <input
                  type="text"
                  inputmode="decimal"
                  autocomplete="off"
                  data-campo-produto="preco"
                  :class="classesInput(row.id, 'preco', inpClass)"
                  :value="fmtPrecoCelula(row.preco)"
                  :disabled="rowDesabilitada(row)"
                  @keydown.enter.prevent="onEnterCelula"
                  @blur="blurPreco(row, $event)"
                />
                </div>
              </td>
              <td :class="tdClass">
                <div :class="classesCelula(row.id, 'preco_prazo', celulaInnerClass)" @click="focusarInputCelula">
                <input
                  type="text"
                  inputmode="decimal"
                  autocomplete="off"
                  data-campo-produto="preco_prazo"
                  :class="classesInput(row.id, 'preco_prazo', inpClass)"
                  :value="fmtPrecoCelula(row.preco_prazo)"
                  :disabled="rowDesabilitada(row)"
                  @keydown.enter.prevent="onEnterCelula"
                  @blur="blurPrecoPrazo(row, $event)"
                />
                </div>
              </td>
              <td :class="tdClass">
                <div :class="classesCelula(row.id, 'preco_promocional', celulaInnerClass)" @click="focusarInputCelula">
                <input
                  type="text"
                  inputmode="decimal"
                  autocomplete="off"
                  data-campo-produto="preco_promocional"
                  :class="classesInput(row.id, 'preco_promocional', inpClass)"
                  :value="fmtPrecoCelula(row.preco_promocional)"
                  :disabled="rowDesabilitada(row)"
                  @keydown.enter.prevent="onEnterCelula"
                  @blur="blurPrecoPromocional(row, $event)"
                />
                </div>
              </td>
              <td :class="tdClass">
                <div :class="classesCelula(row.id, 'peso_kg', celulaInnerClass)" @click="focusarInputCelula">
                <input
                  type="text"
                  inputmode="decimal"
                  autocomplete="off"
                  data-campo-produto="peso_kg"
                  :class="classesInput(row.id, 'peso_kg', inpClass)"
                  :value="row.peso_kg != null ? String(row.peso_kg).replace('.', ',') : ''"
                  :disabled="rowDesabilitada(row)"
                  placeholder="ex.: 1,5"
                  @keydown.enter.prevent="onEnterCelula"
                  @blur="blurPeso(row, $event)"
                />
                </div>
              </td>
              <td :class="tdClass">
                <div :class="classesCelula(row.id, 'largura', celulaInnerClass)" @click="focusarInputCelula">
                <input
                  type="text"
                  inputmode="decimal"
                  autocomplete="off"
                  data-campo-produto="largura"
                  :class="classesInput(row.id, 'largura', inpClass)"
                  :value="String(row.largura ?? 0).replace('.', ',')"
                  :disabled="rowDesabilitada(row)"
                  placeholder="0"
                  @keydown.enter.prevent="onEnterCelula"
                  @blur="blurDimensao(row, 'largura', $event)"
                />
                </div>
              </td>
              <td :class="tdClass">
                <div :class="classesCelula(row.id, 'comprimento', celulaInnerClass)" @click="focusarInputCelula">
                <input
                  type="text"
                  inputmode="decimal"
                  autocomplete="off"
                  data-campo-produto="comprimento"
                  :class="classesInput(row.id, 'comprimento', inpClass)"
                  :value="String(row.comprimento ?? 0).replace('.', ',')"
                  :disabled="rowDesabilitada(row)"
                  placeholder="0"
                  @keydown.enter.prevent="onEnterCelula"
                  @blur="blurDimensao(row, 'comprimento', $event)"
                />
                </div>
              </td>
              <td :class="tdClass">
                <div :class="classesCelula(row.id, 'altura', celulaInnerClass)" @click="focusarInputCelula">
                <input
                  type="text"
                  inputmode="decimal"
                  autocomplete="off"
                  data-campo-produto="altura"
                  :class="classesInput(row.id, 'altura', inpClass)"
                  :value="String(row.altura ?? 0).replace('.', ',')"
                  :disabled="rowDesabilitada(row)"
                  placeholder="0"
                  @keydown.enter.prevent="onEnterCelula"
                  @blur="blurDimensao(row, 'altura', $event)"
                />
                </div>
              </td>
              <td :class="tdClass">
                <div :class="classesCelula(row.id, 'sku', celulaInnerClass)" @click="focusarInputCelula">
                <input
                  type="text"
                  autocomplete="off"
                  data-campo-produto="sku"
                  :class="classesInput(row.id, 'sku', inpClass)"
                  :value="row.sku ?? ''"
                  :disabled="rowDesabilitada(row)"
                  @keydown.enter.prevent="onEnterCelula"
                  @blur="blurSku(row, $event)"
                />
                </div>
              </td>
              <td :class="tdClass">
                <div :class="classesCelula(row.id, 'codigo_ncm', celulaInnerClass)" @click="focusarInputCelula">
                <input
                  type="text"
                  autocomplete="off"
                  data-campo-produto="codigo_ncm"
                  :class="classesInput(row.id, 'codigo_ncm', inpClass)"
                  :value="row.codigo_ncm ?? ''"
                  :disabled="rowDesabilitada(row)"
                  placeholder="NCM"
                  @keydown.enter.prevent="onEnterCelula"
                  @blur="blurCodigoNcm(row, $event)"
                />
                </div>
              </td>
              <td :class="tdClass">
                <div :class="classesCelula(row.id, 'codigo_barras_ean', celulaInnerClass)" @click="focusarInputCelula">
                <input
                  type="text"
                  autocomplete="off"
                  data-campo-produto="codigo_barras_ean"
                  :class="classesInput(row.id, 'codigo_barras_ean', inpClass)"
                  :value="row.codigo_barras_ean ?? ''"
                  :disabled="rowDesabilitada(row)"
                  placeholder="EAN"
                  @keydown.enter.prevent="onEnterCelula"
                  @blur="blurCodigoBarras(row, $event)"
                />
                </div>
              </td>
              <td :class="tdClass">
                <div :class="classesCelula(row.id, 'infos_relevantes', celulaInnerClass)" @click="focusarInputCelula">
                <input
                  type="text"
                  autocomplete="off"
                  data-campo-produto="infos_relevantes"
                  :class="classesInput(row.id, 'infos_relevantes', inpClass)"
                  :value="row.infos_relevantes ?? ''"
                  :disabled="rowDesabilitada(row)"
                  placeholder="—"
                  @keydown.enter.prevent="onEnterCelula"
                  @blur="blurInfos(row, $event)"
                />
                </div>
              </td>
              <td :class="tdClass">
                <div :class="classesCelula(row.id, 'codigo', celulaInnerClass)" @click="focusarInputCelula">
                <input
                  type="text"
                  inputmode="numeric"
                  autocomplete="off"
                  data-campo-produto="codigo"
                  :class="classesInput(row.id, 'codigo', inpClass)"
                  :value="row.codigo != null ? String(row.codigo) : ''"
                  :disabled="rowDesabilitada(row)"
                  title="Código no workspace"
                  @keydown.enter.prevent="onEnterCelula"
                  @blur="blurCodigo(row, $event)"
                />
                </div>
              </td>
              <td :class="tdClass">
                <button
                  type="button"
                  :class="[classesCelula(row.id, 'status', celulaInnerClass), 'cursor-pointer']"
                  :disabled="rowDesabilitada(row)"
                  @click="alternarStatus(row)"
                >
                  <span
                    class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                    :class="
                      row.status
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                        : 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400'
                    "
                  >
                    <span
                      class="h-1.5 w-1.5 shrink-0 rounded-full"
                      :class="row.status ? 'bg-emerald-500' : 'bg-red-500'"
                      aria-hidden="true"
                    />
                    {{ row.status ? 'Ativo' : 'Inativo' }}
                  </span>
                </button>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
      </div>
    </div>

    <ProdutosModalImagens v-if="mostrarImagens" />
    <ProdutosModalNovaVariacao
      v-model:open="modalVariacaoAberto"
      :pai-nome="paiVariacaoAlvo?.nome ?? ''"
      :salvando="salvandoVariacao"
      @salvar="confirmarNovaVariacao"
    />

    <ModalEnvioProdutos
      v-model:open="progressoExclusaoAberto"
      title="A eliminar produtos selecionados…"
      :total="progressoExclusaoTotal"
      :enviados="progressoExclusaoProcessados"
      :erro="progressoExclusaoErro"
      :pode-cancelar="excluindo"
      @cancelar="fecharModalExclusao"
    >
      <template #extra>
        <div class="space-y-2">
          <p class="text-xs font-medium uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
            Selecionados ({{ rotulosExclusao.length }})
          </p>
          <ul
            class="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-outline/20 bg-surface-container-lowest/80 p-2 text-sm dark:border-dark-outline/20 dark:bg-dark-surface-container-lowest/50"
          >
            <li
              v-for="(nome, idx) in rotulosExclusao"
              :key="idx + '-' + nome"
              class="truncate text-on-surface dark:text-dark-on-surface"
            >
              {{ nome }}
            </li>
          </ul>
        </div>
      </template>
    </ModalEnvioProdutos>
  </div>
</template>
