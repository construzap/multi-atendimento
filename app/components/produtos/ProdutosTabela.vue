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
  ProdutosAtualizarEmMassaResponse,
} from '#shared/types/produtos'
import ItemTabela from '~/components/produtos/ItemTabela.vue'
import BaseButton from '~/components/BaseButton.vue'
import ProdutosModalEditarProduto from '~/components/produtos/ProdutosModalEditarProduto.vue'
import ProdutosModalEdicaoMassa from '~/components/produtos/ProdutosModalEdicaoMassa.vue'
import ProdutosModalImagens from '~/components/produtos/ProdutosModalImagens.vue'
import ProdutosModalNovaVariacao from '~/components/produtos/ProdutosModalNovaVariacao.vue'
import ModalAlerta from '~/components/ModalAlerta.vue'
import ModalEnvioProdutos from '~/components/ModalEnvioProdutos.vue'
import { mensagemErroFetch } from '~/stores/canais'
import { useProdutoCategoriasStore } from '~/stores/produtoCategorias'
import { useProdutoTermosPesquisaStore } from '~/stores/produtoTermosPesquisa'
import { useProdutosStore, PRODUTOS_PAGE_SIZE_TODOS } from '~/stores/produtos'
import { parseDecimalPtBr } from '~/utils/mapearLinhasImportacaoProduto'

const produtosStore = useProdutosStore()
const { items: itemsPinia } = storeToRefs(produtosStore)

/** Listagem API vem da Pinia; rascunho continua via prop. */
const itemsExibicao = computed(() =>
  props.modo === 'rascunho' ? props.items : itemsPinia.value,
)

const LS_LARGURAS = 'produtos-tabela-larguras-colunas-v6'
const CHUNK_EXCLUIR_PRODUTOS = 100
const CHUNK_ATUALIZAR_PRODUTOS = 50

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
    /** Limite de produtos do workspace (`null` = sem limite). */
    limiteProdutos?: number | null
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
    limiteProdutos: null,
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

/** Texto do canto superior esquerdo: total + quanto ainda pode adicionar. */
const textoResumoTabela = computed(() => {
  const total = props.total
  const x = total != null && total >= 0 ? total.toLocaleString('pt-BR') : null
  const base =
    x == null
      ? 'Tabela de produtos'
      : `Tabela com ${x} produto${total === 1 ? '' : 's'}!`

  const lim = props.limiteProdutos
  if (lim == null || !Number.isFinite(lim) || lim < 0) return base
  const z = Math.trunc(lim)
  const t = Math.max(0, z - (total ?? 0))
  if (t === 0) {
    return `${base} Limite atingido (${z}).`
  }
  return `${base} Você ainda pode adicionar ${t} de ${z}.`
})

const resumoTabelaEsgotado = computed(() => {
  const lim = props.limiteProdutos
  if (lim == null || !Number.isFinite(lim) || lim < 0) return false
  const z = Math.trunc(lim)
  return Math.max(0, z - (props.total ?? 0)) === 0
})

const excluindo = ref(false)
const progressoExclusaoAberto = ref(false)
const progressoExclusaoTotal = ref(0)
const progressoExclusaoProcessados = ref(0)
const progressoExclusaoErro = ref<string | null>(null)
const rotulosExclusao = ref<string[]>([])
let abortExclusao: AbortController | null = null

const editandoMassa = ref(false)
const modalEdicaoMassaAberto = ref(false)
const progressoEdicaoMassaAberto = ref(false)
const progressoEdicaoMassaTotal = ref(0)
const progressoEdicaoMassaProcessados = ref(0)
const progressoEdicaoMassaErro = ref<string | null>(null)
const rotulosEdicaoMassa = ref<string[]>([])
let abortEdicaoMassa: AbortController | null = null

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
      extra.termos_pesquisa_busca =
        (extra.termos_pesquisa as { nome: string }[]).map((t) => t.nome).join(' ') || null
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
const modalEdicaoAberto = ref(false)
const produtoEmEdicao = ref<ProdutoWorkspaceCampos | null>(null)
const alertaApagarAberto = ref(false)
const produtoParaApagar = ref<ProdutoWorkspaceCampos | null>(null)
const apagandoUm = ref(false)
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

function encontrarRowPorId(id: number): ProdutoWorkspaceCampos | null {
  for (const pai of itemsPinia.value) {
    if (pai.id === id) return pai
    for (const v of pai.variacoes ?? []) {
      if (v.id === id) return v
    }
  }
  return null
}

function cancelarEdicaoMassa() {
  abortEdicaoMassa?.abort()
}

function reverterPatchLocal(
  id: number,
  antes: ProdutoWorkspaceCampos,
  campos: string[],
) {
  const row = encontrarRowPorId(id)
  if (!row) return
  const revert: Record<string, unknown> = {}
  const snapshot = antes as Record<string, unknown>
  for (const c of campos) {
    if (c in snapshot) revert[c] = snapshot[c]
  }
  emitLinhaLocal(row, revert as ProdutoWorkspacePatch)
  flashErroCelulas(id, campos)
}

function mergeTermosIdsExistentes(row: ProdutoWorkspaceCampos, novosIds: number[]): number[] {
  const existentes = (row.termos_pesquisa ?? []).map((t) => t.id)
  return [...new Set([...existentes, ...novosIds])]
}

function patchTermosMassaAdicionar(
  row: ProdutoWorkspaceCampos,
  patch: ProdutoWorkspacePatch,
): ProdutoWorkspacePatch {
  if (patch.termos_pesquisa_ids === undefined) return patch
  return {
    ...patch,
    termos_pesquisa_ids: mergeTermosIdsExistentes(row, patch.termos_pesquisa_ids ?? []),
  }
}

async function aplicarEdicaoMassa(patch: ProdutoWorkspacePatch) {
  if (props.modo === 'rascunho') return
  const wid = props.workspaceId
  if (wid == null || wid < 1) return
  const ids = [...new Set(selecionadosIds.value)]
  if (!ids.length) return

  modalEdicaoMassaAberto.value = false

  progressoEdicaoMassaTotal.value = ids.length
  progressoEdicaoMassaProcessados.value = 0
  progressoEdicaoMassaErro.value = null
  rotulosEdicaoMassa.value = rotulosDosIds(ids)
  progressoEdicaoMassaAberto.value = true
  editandoMassa.value = true
  abortEdicaoMassa = new AbortController()
  const signal = abortEdicaoMassa.signal
  const campos = camposDoPatch(patch)

  const snapshots = new Map<number, ProdutoWorkspaceCampos>()
  for (const id of ids) {
    const row = encontrarRowPorId(id)
    if (!row) continue
    snapshots.set(id, clonarLinhaParaSalvar(row))
    emitLinhaLocal(row, patchTermosMassaAdicionar(row, patch))
  }

  let sucesso = 0
  let erros = 0
  let cancelado = false
  const confirmados = new Set<number>()

  try {
    for (let i = 0; i < ids.length; i += CHUNK_ATUALIZAR_PRODUTOS) {
      if (signal.aborted) {
        cancelado = true
        break
      }

      const chunk = ids.slice(i, i + CHUNK_ATUALIZAR_PRODUTOS)
      const chunkComSnapshot = chunk.filter((id) => snapshots.has(id))
      if (!chunkComSnapshot.length) {
        progressoEdicaoMassaProcessados.value = Math.min(i + chunk.length, ids.length)
        continue
      }

      try {
        const res = await $fetch<ProdutosAtualizarEmMassaResponse>(
          '/api/produtos/atualizar-em-massa',
          {
            method: 'PATCH',
            body: { workspace_id: wid, ids: chunkComSnapshot, patch },
            signal,
          },
        )

        const okSet = new Set(res.ids ?? [])
        sucesso += res.atualizados ?? 0

        for (const id of chunkComSnapshot) {
          if (okSet.has(id)) {
            confirmados.add(id)
            continue
          }
          erros++
          const antes = snapshots.get(id)
          if (antes) reverterPatchLocal(id, antes, campos)
        }
      } catch (err: unknown) {
        const e = err as { name?: string }
        if (e?.name === 'AbortError') {
          cancelado = true
          for (const id of chunkComSnapshot) {
            if (confirmados.has(id)) continue
            const antes = snapshots.get(id)
            if (antes) reverterPatchLocal(id, antes, campos)
          }
          break
        }
        erros += chunkComSnapshot.length
        for (const id of chunkComSnapshot) {
          const antes = snapshots.get(id)
          if (antes) reverterPatchLocal(id, antes, campos)
        }
        if (!progressoEdicaoMassaErro.value) {
          progressoEdicaoMassaErro.value = mensagemErroFetch(
            err,
            'Não foi possível atualizar todos os produtos.',
          )
        }
      } finally {
        progressoEdicaoMassaProcessados.value = Math.min(i + chunk.length, ids.length)
      }
    }

    if (cancelado) {
      for (const id of ids) {
        if (confirmados.has(id)) continue
        const antes = snapshots.get(id)
        if (antes) reverterPatchLocal(id, antes, campos)
      }
      toast.info('Atualização cancelada.')
      progressoEdicaoMassaAberto.value = false
    } else if (erros === 0) {
      progressoEdicaoMassaAberto.value = false
      selecionadosIds.value = []
      if (sucesso === 1) toast.success('1 produto atualizado.')
      else if (sucesso > 1) toast.success(`${sucesso} produtos atualizados.`)
    } else if (sucesso > 0) {
      toast.warning(`${sucesso} atualizado(s), ${erros} com erro.`)
    } else {
      progressoEdicaoMassaAberto.value = false
      toast.error('Não foi possível atualizar os produtos selecionados.')
    }
  } finally {
    editandoMassa.value = false
    abortEdicaoMassa = null
  }
}

function fecharModalEdicaoMassa() {
  if (editandoMassa.value) {
    cancelarEdicaoMassa()
    return
  }
  progressoEdicaoMassaAberto.value = false
  progressoEdicaoMassaErro.value = null
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

function onMudarPageSize(ev: Event) {
  const raw = (ev.target as HTMLSelectElement).value
  const n = Number.parseInt(String(raw), 10)
  if (!Number.isFinite(n) || (n < 1 && n !== PRODUTOS_PAGE_SIZE_TODOS)) return
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

defineExpose({
  resetarEstadoPosImportacao,
  focarNomeUltimaLinha,
  abrirEdicaoUltimaLinha,
  sincronizarInputsRascunho,
})

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
  await abrirEdicaoUltimaLinha()
}

async function abrirEdicaoUltimaLinha() {
  await nextTick()
  const last = itemsExibicao.value[itemsExibicao.value.length - 1]
  if (last) abrirEdicaoCompleta(last)
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
  await abrirEdicaoUltimaLinha()
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

function abrirEdicaoCompleta(row: ProdutoWorkspaceCampos) {
  if (rowDesabilitada(row) && props.modo === 'api') return
  produtoEmEdicao.value = row
  modalEdicaoAberto.value = true
}

function aoSalvarEdicaoCompleta(patch: ProdutoWorkspacePatch) {
  const row = produtoEmEdicao.value
  if (!row) return
  void gravarPatch(row, patch)
}

function pedirApagar(row: ProdutoWorkspaceCampos) {
  if (props.modo !== 'api') return
  if (rowDesabilitada(row)) return
  produtoParaApagar.value = row
  alertaApagarAberto.value = true
}

function cancelarApagar() {
  if (apagandoUm.value) return
  alertaApagarAberto.value = false
  produtoParaApagar.value = null
}

const textoAlertaApagar = computed(() => {
  const nome = produtoParaApagar.value?.nome?.trim()
  if (nome) {
    return `Eliminar o produto «${nome}»? Esta ação não pode ser anulada.`
  }
  return 'Eliminar este produto? Esta ação não pode ser anulada.'
})

async function confirmarApagar() {
  if (props.modo !== 'api') return
  const row = produtoParaApagar.value
  const wid = props.workspaceId
  if (!row || wid == null || wid < 1) return
  if (apagandoUm.value) return

  apagandoUm.value = true
  const id = row.id
  const snapshot = produtosStore.removerProdutosOtimista([id])
  selecionadosIds.value = selecionadosIds.value.filter((x) => x !== id)
  alertaApagarAberto.value = false
  produtoParaApagar.value = null

  try {
    const res = await $fetch<ProdutosExcluirResponse>('/api/produtos/enviar-para-ia/excluir', {
      method: 'POST',
      body: { workspace_id: wid, ids: [id] },
    })
    if ((res.removidos ?? 0) <= 0) {
      toast.info('Nenhum produto foi eliminado (o id pode já não existir).')
    } else {
      toast.success('Produto eliminado.')
    }
    emit('eliminados')
  } catch (err: unknown) {
    produtosStore.restaurarProdutosOtimista(snapshot)
    flashErroCelulas(id, ['nome'])
    toast.error(mensagemErroFetch(err, 'Não foi possível eliminar o produto.'))
  } finally {
    apagandoUm.value = false
  }
}

function rowDesabilitada(row: ProdutoWorkspaceCampos): boolean {
  if (props.modo === 'rascunho') return false
  return !podeGravar() || excluindo.value || editandoMassa.value || apagandoUm.value
}

onUnmounted(() => {
  for (const t of celulaErroTimers.values()) clearTimeout(t)
  celulaErroTimers.clear()
})
</script>

<template>
  <div
    class="w-full min-w-0 overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
  >
    <div
      v-if="mostrarLimiteLinhas"
      class="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <p
        class="text-sm font-semibold"
        :class="
          resumoTabelaEsgotado
            ? 'text-red-600 dark:text-red-400'
            : 'text-zinc-900 dark:text-zinc-100'
        "
      >
        {{ textoResumoTabela }}
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
          <option :value="PRODUTOS_PAGE_SIZE_TODOS">Todos</option>
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
        v-if="mostrarSelecao && modo === 'api' && podeGravar()"
        class="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/80"
      >
        <div class="flex min-w-0 items-center gap-3">
          <label
            class="group/check flex cursor-pointer items-center gap-2"
            :class="
              pending || !itemsExibicao.length || excluindo || editandoMassa
                ? 'cursor-not-allowed opacity-40'
                : ''
            "
          >
            <span
              :class="[
                checkboxVisualBaseClass,
                todosDaPaginaSelecionados || indeterminadoCabecalhoPagina
                  ? checkboxVisualMarcadoClass
                  : 'border-zinc-300/90 bg-white opacity-100 dark:border-zinc-600 dark:bg-zinc-950',
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
              :disabled="pending || !itemsExibicao.length || excluindo || editandoMassa"
              aria-label="Selecionar todos os produtos desta página"
              @change="alternarSelecionarTodosNaPagina(($event.target as HTMLInputElement).checked)"
            />
            <span class="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              <template v-if="selecionadosIds.length > 0">
                <strong>{{ selecionadosIds.length }}</strong>
                <template v-if="selecionadosIds.length === 1"> produto selecionado</template>
                <template v-else> produtos selecionados</template>
              </template>
              <template v-else>Selecionar todos nesta página</template>
            </span>
          </label>
        </div>
        <div v-if="selecionadosIds.length > 0" class="flex flex-wrap items-center gap-2">
          <BaseButton
            type="button"
            variant="primary"
            size="sm"
            :block="false"
            class="gap-2"
            :disabled="editandoMassa || excluindo"
            @click="modalEdicaoMassaAberto = true"
          >
            <span class="material-symbols-outlined text-[20px]" aria-hidden="true">edit_square</span>
            {{ editandoMassa ? 'A atualizar…' : 'Alterar em massa' }}
          </BaseButton>
          <BaseButton
            v-if="mostrarExclusao"
            type="button"
            variant="danger"
            size="sm"
            :block="false"
            class="gap-2"
            :disabled="excluindo || editandoMassa"
            @click="excluirSelecionados"
          >
            <span class="material-symbols-outlined text-[20px]" aria-hidden="true">delete</span>
            {{ excluindo ? 'A eliminar…' : 'Excluir selecionados' }}
          </BaseButton>
        </div>
      </div>

      <!-- Lista em cards (listagem API e rascunho criar em massa) -->
      <div
        ref="tabelaScrollRef"
        class="w-full min-w-0 max-w-full"
        :class="{ 'pointer-events-none opacity-50': excluindo || editandoMassa }"
      >
        <div
          v-if="pending"
          class="py-12 text-center text-sm text-zinc-500 dark:text-zinc-400"
        >
          Carregando…
        </div>
        <template v-else>
          <ItemTabela
            v-for="{ row, tipo, pai } in linhasExibicao"
            :key="tipo + '-' + row.id"
            :row="row"
            :tipo="tipo"
            :pai="pai"
            :workspace-id="workspaceId"
            :selecionado="selecionadosIds.includes(row.id)"
            :mostrar-selecao="mostrarSelecao"
            :desabilitado="rowDesabilitada(row)"
            :mostrar-imagens="mostrarImagens"
            :mostrar-nova-variacao="modo === 'api'"
            :tem-variacoes-visiveis="!!(pai && paiTemVariacoesVisiveis(pai))"
            :expandido="estaExpandido(row.id)"
            :salvando-variacao="salvandoVariacao"
            :url-imagem="urlImagemLinha(row)"
            :contagem-imagens="contagemImagensLinha(row)"
            :resumo-variacao="tipo === 'variacao' ? resumoVariacao(row) : ''"
            @toggle-selecionado="alternarSelecionado(row.id, $event)"
            @toggle-status="alternarStatus(row)"
            @toggle-expandir="toggleExpandir(row.id)"
            @abrir-imagens="abrirGaleriaImagens(row, tipo, pai)"
            @nova-variacao="abrirModalNovaVariacao(pai ?? (row as ProdutoWorkspaceItem))"
            @editar="abrirEdicaoCompleta(row)"
            @apagar="pedirApagar(row)"
            @commit-termo="commitCatalogo(row, $event)"
          />
        </template>
      </div>
    </div>

    <ProdutosModalImagens v-if="mostrarImagens" />
    <ProdutosModalNovaVariacao
      v-model:open="modalVariacaoAberto"
      :pai-nome="paiVariacaoAlvo?.nome ?? ''"
      :salvando="salvandoVariacao"
      @salvar="confirmarNovaVariacao"
    />
    <ProdutosModalEdicaoMassa
      v-model:open="modalEdicaoMassaAberto"
      :workspace-id="workspaceId"
      :quantidade="selecionadosIds.length"
      @aplicar="aplicarEdicaoMassa"
    />

    <ProdutosModalEditarProduto
      v-model:open="modalEdicaoAberto"
      :workspace-id="workspaceId"
      :row="produtoEmEdicao"
      @salvar="aoSalvarEdicaoCompleta"
    />

    <ModalAlerta
      v-model:open="alertaApagarAberto"
      title="Apagar produto"
      :texto="textoAlertaApagar"
      variante="perigo"
      texto-confirmar="Apagar"
      texto-cancelar="Cancelar"
      :confirmar-desabilitado="apagandoUm"
      :cancelar-desabilitado="apagandoUm"
      @confirmar="confirmarApagar"
      @cancelar="cancelarApagar"
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

    <ModalEnvioProdutos
      v-model:open="progressoEdicaoMassaAberto"
      title="A atualizar produtos selecionados…"
      :total="progressoEdicaoMassaTotal"
      :enviados="progressoEdicaoMassaProcessados"
      :erro="progressoEdicaoMassaErro"
      :pode-cancelar="editandoMassa"
      @cancelar="fecharModalEdicaoMassa"
    >
      <template #extra>
        <div class="space-y-2">
          <p class="text-xs font-medium uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
            Selecionados ({{ rotulosEdicaoMassa.length }})
          </p>
          <ul
            class="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-outline/20 bg-surface-container-lowest/80 p-2 text-sm dark:border-dark-outline/20 dark:bg-dark-surface-container-lowest/50"
          >
            <li
              v-for="(nome, idx) in rotulosEdicaoMassa"
              :key="idx"
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
