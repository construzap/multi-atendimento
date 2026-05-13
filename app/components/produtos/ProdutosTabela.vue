<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import type {
  ProdutoAtualizarResponse,
  ProdutoWorkspaceItem,
  ProdutoWorkspacePatch,
  ProdutosExcluirResponse,
} from '#shared/types/produtos'
import { mensagemErroFetch } from '~/stores/canais'
import ProdutosItemCategoria from '~/components/produtos/ProdutosItemCategoria.vue'
import { parseDecimalPtBr } from '~/utils/mapearLinhasImportacaoProduto'

const LS_LARGURAS = 'produtos-tabela-larguras-colunas-v4'

/** `true` para voltar a mostrar a coluna «Imagem» (URL + miniatura). */
const EXIBIR_COLUNA_IMAGEM = false

const columns = [
  { id: 'sel' as const, label: '' },
  ...(EXIBIR_COLUNA_IMAGEM ? ([{ id: 'imagem' as const, label: 'Imagem' }] as const) : []),
  { id: 'produto', label: 'Produto' },
  { id: 'categoria', label: 'Categoria' },
  { id: 'unidade', label: 'Unidade de Venda' },
  { id: 'preco', label: 'Preço a vista' },
  { id: 'prazo', label: 'Preço a Prazo' },
  { id: 'peso', label: 'Peso(Kg)' },
  { id: 'codigo', label: 'Código' },
  { id: 'sku', label: 'SKU' },
  { id: 'status', label: 'STATUS' },
] as const

type ColId = (typeof columns)[number]['id']

const DEFAULT_WIDTHS: Record<ColId, number> = {
  sel: 52,
  ...(EXIBIR_COLUNA_IMAGEM ? { imagem: 200 } : {}),
  produto: 320,
  categoria: 220,
  unidade: 200,
  preco: 128,
  prazo: 128,
  peso: 118,
  codigo: 104,
  sku: 132,
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

/** Largura real da grelha (soma das colunas) para não comprimir com `w-full` + `table-fixed`. */
const larguraTabelaPx = computed(() =>
  columns.reduce((acc, c) => acc + (colWidths.value[c.id] ?? DEFAULT_WIDTHS[c.id]), 0),
)

const thClass =
  'relative border border-outline/35 bg-surface-container-high/95 px-4 py-3.5 text-left align-middle font-headline text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant dark:border-dark-outline/40 dark:bg-dark-surface-container-high/90 dark:text-dark-on-surface-variant'

const tdClass =
  'border border-outline/35 bg-surface-container-lowest px-4 py-3.5 align-middle dark:border-dark-outline/40 dark:bg-dark-surface-container-lowest'

const inpClass =
  'block w-full min-w-0 rounded-md border border-transparent bg-transparent px-3 py-2.5 text-sm text-on-surface shadow-none transition-colors placeholder:text-outline/45 hover:border-outline/25 focus:border-primary-500 focus:bg-surface-container-low/90 focus:outline-none focus:ring-1 focus:ring-primary-500/30 dark:text-dark-on-surface dark:placeholder:text-dark-outline/45 dark:hover:border-dark-outline/30 dark:focus:bg-dark-surface-container-low/90 dark:focus:border-primary-400'

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
    items: ProdutoWorkspaceItem[]
    /** Obrigatório para gravar alterações na API. */
    workspaceId?: number | null
    pending?: boolean
    error?: string | null
  }>(),
  {
    workspaceId: null,
    pending: false,
    error: null,
    items: () => [],
  },
)

const emit = defineEmits<{
  atualizado: [row: ProdutoWorkspaceItem]
  'erro-salvamento': []
  /** Após exclusão em massa bem-sucedida; o pai deve recarregar a listagem. */
  eliminados: []
}>()

const salvandoId = ref<number | null>(null)
const excluindo = ref(false)
/** Ids selecionados (podem abranger várias páginas). */
const selecionadosIds = ref<number[]>([])

const idsNaPagina = computed(() => props.items.map((r) => r.id))

const todosDaPaginaSelecionados = computed(
  () => props.items.length > 0 && props.items.every((r) => selecionadosIds.value.includes(r.id)),
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

async function excluirSelecionados() {
  const wid = props.workspaceId
  if (wid == null || wid < 1) return
  const ids = [...new Set(selecionadosIds.value)]
  if (!ids.length) return
  const msg =
    ids.length === 1
      ? 'Eliminar este produto? Esta ação não pode ser anulada.'
      : `Eliminar ${ids.length} produtos? Esta ação não pode ser anulada.`
  if (!window.confirm(msg)) return
  excluindo.value = true
  try {
    const res = await $fetch<ProdutosExcluirResponse>('/api/produtos/excluir', {
      method: 'POST',
      body: { workspace_id: wid, ids },
    })
    selecionadosIds.value = []
    emit('eliminados')
    if (res.removidos <= 0) {
      toast.info('Nenhum produto foi eliminado (ids podem já não existir).')
    } else if (res.removidos === 1) {
      toast.success('1 produto eliminado.')
    } else {
      toast.success(`${res.removidos} produtos eliminados.`)
    }
  } catch (err) {
    toast.error(mensagemErroFetch(err, 'Não foi possível eliminar os produtos.'))
  } finally {
    excluindo.value = false
  }
}

function podeGravar(): boolean {
  const w = props.workspaceId
  return w != null && Number.isFinite(w) && w >= 1
}

watch(
  () => props.workspaceId,
  () => {
    selecionadosIds.value = []
  },
)

async function gravarPatch(row: ProdutoWorkspaceItem, patch: ProdutoWorkspacePatch) {
  if (!podeGravar()) return
  const keys = Object.keys(patch) as (keyof ProdutoWorkspacePatch)[]
  if (!keys.length) return
  salvandoId.value = row.id
  try {
    const res = await $fetch<ProdutoAtualizarResponse>('/api/produtos/atualizar', {
      method: 'PATCH',
      body: {
        workspace_id: props.workspaceId,
        id: row.id,
        patch,
      },
    })
    emit('atualizado', res.data)
  } catch (err) {
    toast.error(mensagemErroFetch(err, 'Não foi possível guardar a alteração.'))
    emit('erro-salvamento')
  } finally {
    salvandoId.value = null
  }
}

function blurEnter(el: Event) {
  const t = el.target as HTMLInputElement | HTMLTextAreaElement
  t.blur()
}

function fmtPrecoInput(n: number): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

function eqNum(a: number | null | undefined, b: number | null | undefined): boolean {
  if (a == null && b == null) return true
  if (a == null || b == null) return false
  return Math.abs(a - b) < 1e-9
}

function blurNome(row: ProdutoWorkspaceItem, ev: Event) {
  const v = (ev.target as HTMLInputElement).value.trim()
  if (!v) {
    toast.error('O nome não pode ser vazio.')
    return
  }
  if (v === row.nome.trim()) return
  void gravarPatch(row, { nome: v })
}

function blurUnidade(row: ProdutoWorkspaceItem, ev: Event) {
  const v = (ev.target as HTMLInputElement).value.trim()
  const atual = (row.unidade_venda ?? '').trim()
  if (v === atual) return
  void gravarPatch(row, { unidade_venda: v.length ? v : null })
}

function blurPreco(row: ProdutoWorkspaceItem, ev: Event) {
  const raw = (ev.target as HTMLInputElement).value.trim()
  const n = raw.length === 0 ? 0 : (parseDecimalPtBr(raw) ?? null)
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

function blurPrecoPrazo(row: ProdutoWorkspaceItem, ev: Event) {
  const raw = (ev.target as HTMLInputElement).value.trim()
  if (!raw.length) {
    if (row.preco_prazo == null) return
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

function blurPeso(row: ProdutoWorkspaceItem, ev: Event) {
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

function blurCodigo(row: ProdutoWorkspaceItem, ev: Event) {
  const raw = (ev.target as HTMLInputElement).value.trim()
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 1) {
    toast.error('Informe um código inteiro ≥ 1.')
    return
  }
  if (n === row.codigo) return
  void gravarPatch(row, { codigo: n })
}

function blurSku(row: ProdutoWorkspaceItem, ev: Event) {
  const v = (ev.target as HTMLInputElement).value.trim()
  const atual = (row.sku ?? '').trim()
  if (v === atual) return
  void gravarPatch(row, { sku: v.length ? v : null })
}

function blurImagem(row: ProdutoWorkspaceItem, ev: Event) {
  const v = (ev.target as HTMLInputElement).value.trim()
  const atual = (row.imagem_url ?? '').trim()
  if (v === atual) return
  void gravarPatch(row, { imagem_url: v.length ? v : null })
}

function alternarStatus(row: ProdutoWorkspaceItem) {
  void gravarPatch(row, { status: !row.status })
}

function rowDesabilitada(row: ProdutoWorkspaceItem): boolean {
  return !podeGravar() || salvandoId.value === row.id || excluindo.value
}
</script>

<template>
  <div
    class="w-full min-w-0 overflow-hidden rounded-xl border border-outline/30 bg-surface-container-lowest shadow-sm dark:border-dark-outline/35 dark:bg-dark-surface-container-lowest"
  >
    <div v-if="error" class="border-b border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
      {{ error }}
    </div>

    <div v-else-if="!pending && items.length === 0" class="m-6 rounded-xl border border-dashed border-outline/40 py-12 text-center text-sm text-on-surface-variant dark:border-dark-outline/40 dark:text-dark-on-surface-variant">
      Nenhum produto encontrado.
    </div>

    <div v-else class="w-full min-w-0 max-w-full overflow-x-auto">
      <p
        v-if="!podeGravar()"
        class="border-b border-amber-200/80 bg-amber-50/90 px-4 py-2.5 text-xs text-amber-950 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-100"
      >
        Abra esta página dentro de um workspace para poder editar produtos.
      </p>

      <div
        v-if="selecionadosIds.length > 0 && podeGravar()"
        class="flex flex-wrap items-center justify-between gap-3 border-b border-outline/30 bg-primary-500/10 px-4 py-3 dark:border-dark-outline/30 dark:bg-primary-500/15"
      >
        <p class="text-sm font-medium text-on-surface dark:text-dark-on-surface">
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

      <table
        class="table-fixed border-collapse text-left"
        :style="{ width: larguraTabelaPx + 'px' }"
      >
        <colgroup>
          <col v-for="c in columns" :key="'cw-' + c.id" :style="{ width: colWidths[c.id] + 'px' }" />
        </colgroup>
        <thead>
          <tr>
            <th
              v-for="col in columns"
              :key="col.id"
              :class="[thClass, col.id === 'sel' ? 'px-2 text-center' : '']"
            >
              <template v-if="col.id === 'sel'">
                <input
                  type="checkbox"
                  class="mx-auto block h-4 w-4 rounded border-outline/50 accent-primary-600 focus:ring-2 focus:ring-primary-500/35 dark:border-dark-outline/55"
                  :checked="todosDaPaginaSelecionados"
                  :indeterminate="indeterminadoCabecalhoPagina"
                  :disabled="pending || !items.length || !podeGravar() || excluindo"
                  aria-label="Selecionar todos os produtos desta página"
                  @change="alternarSelecionarTodosNaPagina(($event.target as HTMLInputElement).checked)"
                />
              </template>
              <template v-else>
                <div class="flex min-w-0 items-start gap-1.5 pr-4">
                  <span
                    class="material-symbols-outlined mt-0.5 shrink-0 rotate-90 text-[15px] leading-none text-on-surface-variant/45 dark:text-dark-on-surface-variant/45"
                    aria-hidden="true"
                  >
                    drag_indicator
                  </span>
                  <span class="min-w-0 leading-snug">{{ col.label }}</span>
                </div>
                <span
                  class="absolute inset-y-0 right-0 z-20 w-3 cursor-col-resize select-none hover:bg-primary-500/25 active:bg-primary-500/35"
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
            <td :colspan="columns.length" :class="[tdClass, 'py-10 text-center text-sm text-on-surface-variant dark:text-dark-on-surface-variant']">
              Carregando…
            </td>
          </tr>
          <template v-if="!pending">
            <tr
              v-for="row in items"
              :key="row.id"
              class="bg-surface-container-lowest transition-colors hover:bg-surface-container-low/40 dark:bg-dark-surface-container-lowest dark:hover:bg-dark-surface-container-low/35"
              :class="{ 'pointer-events-none opacity-50': salvandoId === row.id || excluindo }"
            >
              <td :class="[tdClass, 'px-2 text-center align-middle']">
                <input
                  type="checkbox"
                  class="mx-auto block h-4 w-4 rounded border-outline/50 accent-primary-600 focus:ring-2 focus:ring-primary-500/35 dark:border-dark-outline/55"
                  :checked="selecionadosIds.includes(row.id)"
                  :disabled="rowDesabilitada(row)"
                  :aria-label="'Selecionar produto ' + row.nome"
                  @click.stop
                  @change="alternarSelecionado(row.id, ($event.target as HTMLInputElement).checked)"
                />
              </td>
              <td v-if="EXIBIR_COLUNA_IMAGEM" :class="tdClass">
                <div class="flex flex-col gap-2">
                  <img
                    v-if="row.imagem_url"
                    :src="row.imagem_url"
                    alt=""
                    class="h-11 w-11 shrink-0 rounded-md border border-outline/35 object-cover dark:border-dark-outline/40"
                    loading="lazy"
                  />
                  <input
                    type="url"
                    autocomplete="off"
                    :class="inpClass"
                    :value="row.imagem_url ?? ''"
                    :disabled="rowDesabilitada(row)"
                    placeholder="https://…"
                    @keydown.enter.prevent="blurEnter"
                    @blur="blurImagem(row, $event)"
                  />
                </div>
              </td>
              <td :class="tdClass">
                <input
                  type="text"
                  autocomplete="off"
                  :class="[inpClass, 'font-semibold']"
                  :value="row.nome"
                  :disabled="rowDesabilitada(row)"
                  :title="row.nome"
                  @keydown.enter.prevent="blurEnter"
                  @blur="blurNome(row, $event)"
                />
              </td>
              <td :class="[tdClass, 'overflow-visible align-top']">
                <ProdutosItemCategoria
                  variant="celula"
                  :workspace-id="workspaceId"
                  :produto-id="row.id"
                  :categoria-id="row.categoria_id"
                  :categoria-nome="row.categoria_nome"
                  :disabled="rowDesabilitada(row)"
                  @commit="(patch) => gravarPatch(row, patch)"
                />
              </td>
              <td :class="tdClass">
                <input
                  type="text"
                  autocomplete="off"
                  :class="inpClass"
                  :value="row.unidade_venda ?? ''"
                  :disabled="rowDesabilitada(row)"
                  @keydown.enter.prevent="blurEnter"
                  @blur="blurUnidade(row, $event)"
                />
              </td>
              <td :class="tdClass">
                <input
                  type="text"
                  inputmode="decimal"
                  autocomplete="off"
                  :class="[inpClass, 'font-semibold']"
                  :value="fmtPrecoInput(row.preco)"
                  :disabled="rowDesabilitada(row)"
                  @keydown.enter.prevent="blurEnter"
                  @blur="blurPreco(row, $event)"
                />
              </td>
              <td :class="tdClass">
                <input
                  type="text"
                  inputmode="decimal"
                  autocomplete="off"
                  :class="inpClass"
                  :value="row.preco_prazo != null ? fmtPrecoInput(row.preco_prazo) : ''"
                  :disabled="rowDesabilitada(row)"
                  placeholder="Opcional"
                  @keydown.enter.prevent="blurEnter"
                  @blur="blurPrecoPrazo(row, $event)"
                />
              </td>
              <td :class="tdClass">
                <input
                  type="text"
                  inputmode="decimal"
                  autocomplete="off"
                  :class="inpClass"
                  :value="row.peso_kg != null ? String(row.peso_kg).replace('.', ',') : ''"
                  :disabled="rowDesabilitada(row)"
                  placeholder="ex.: 1,5"
                  @keydown.enter.prevent="blurEnter"
                  @blur="blurPeso(row, $event)"
                />
              </td>
              <td :class="tdClass">
                <input
                  type="text"
                  inputmode="numeric"
                  autocomplete="off"
                  :class="inpClass"
                  :value="row.codigo != null ? String(row.codigo) : ''"
                  :disabled="rowDesabilitada(row)"
                  title="Código no workspace"
                  @keydown.enter.prevent="blurEnter"
                  @blur="blurCodigo(row, $event)"
                />
              </td>
              <td :class="tdClass">
                <input
                  type="text"
                  autocomplete="off"
                  :class="inpClass"
                  :value="row.sku ?? ''"
                  :disabled="rowDesabilitada(row)"
                  @keydown.enter.prevent="blurEnter"
                  @blur="blurSku(row, $event)"
                />
              </td>
              <td :class="tdClass">
                <button
                  type="button"
                  class="inline-flex rounded-md px-3 py-2 text-[11px] font-bold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  :class="
                    row.status
                      ? 'bg-[#e6f4ea] text-[#1e7e34] dark:bg-emerald-950/40 dark:text-emerald-300'
                      : 'bg-[#fdecea] text-[#d32f2f] dark:bg-red-950/40 dark:text-red-300'
                  "
                  :disabled="rowDesabilitada(row)"
                  @click="alternarStatus(row)"
                >
                  {{ row.status ? 'Ativo' : 'Inativo' }}
                </button>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>
