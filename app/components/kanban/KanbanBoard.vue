<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import type { KanbanCard as KanbanCardModel, KanbanColumn as KanbanColumnData } from '#shared/types/kanban'
import BaseInput from '~/components/BaseInput.vue'
import KanbanColumn from './KanbanColumn.vue'
import ModalNovaColuna from './ModalNovaColuna.vue'
import InfoContatoKanban from './InfoContatoKanban/InfoContatoKanban.vue'
import FerramentaImportarContato from './importar-contatos/FerramentaImportarContato.vue'
import ModalAlerta from '~/components/ModalAlerta.vue'
import SelecaoMultiplaBar from '~/components/kanban/SelecaoMultiplaBar.vue'
import { useCanaisStore } from '~/stores/canais'
import { useKanbanStore } from '~/stores/kanban'

type DragState = {
  cardId: string
  fromColumnId: string
} | null

const props = defineProps<{
  workspaceId: number
}>()

const router = useRouter()
const kanban = useKanbanStore()
const canaisStore = useCanaisStore()
const {
  columns,
  reorderingColumnId,
  loadingMoreByColumn,
  busca,
  pending,
  ocultarGrupos,
  filtroCanalId,
} = storeToRefs(kanban)

const buscaInput = ref('')
const alternandoOcultarGrupos = ref(false)
const alternandoFiltroCanal = ref(false)
let buscaTimer: ReturnType<typeof setTimeout> | null = null

const selectedKeys = ref<string[]>([])
const selectedCount = computed(() => selectedKeys.value.length)
const selectionActive = computed(() => selectedCount.value > 0)

function isSelected(key: string): boolean {
  const k = key.trim()
  if (!k) return false
  return selectedKeys.value.includes(k)
}

function toggleSelected(key: string, nextSelected?: boolean) {
  const k = key.trim()
  if (!k) return
  const cur = isSelected(k)
  const next = nextSelected ?? !cur
  if (next === cur) return
  if (next) {
    selectedKeys.value = [...selectedKeys.value, k]
    return
  }
  selectedKeys.value = selectedKeys.value.filter((x) => x !== k)
}

function clearSelection() {
  selectedKeys.value = []
}

function onAlterarCampos() {
  // Somente UI por enquanto (pedido: nenhuma chamada).
  toast.info('Ação: Alterar campos (UI apenas).')
}

const canaisDoWorkspace = computed(() =>
  canaisStore.items.filter((c) => c.id != null && c.id > 0),
)

const filtroCanalSelect = computed({
  get: () => (filtroCanalId.value != null ? String(filtroCanalId.value) : ''),
  set: (v: string) => {
    void onFiltroCanalChange(v)
  },
})

onMounted(() => {
  if (props.workspaceId) {
    void canaisStore.ensureCanaisLoaded(props.workspaceId).catch(() => {})
  }
})

watch(
  () => props.workspaceId,
  (wid) => {
    if (wid) void canaisStore.ensureCanaisLoaded(wid).catch(() => {})
  },
)

watch(
  busca,
  (v) => {
    if (buscaInput.value !== v) buscaInput.value = v
  },
  { immediate: true },
)

function agendarBusca() {
  if (buscaTimer) clearTimeout(buscaTimer)
  buscaTimer = setTimeout(() => {
    buscaTimer = null
    if (!props.workspaceId) return
    void kanban.applyBusca(props.workspaceId, buscaInput.value)
  }, 400)
}

function limparBusca() {
  buscaInput.value = ''
  agendarBusca()
}

async function onOcultarGruposChange(e: Event) {
  if (!props.workspaceId || alternandoOcultarGrupos.value) return
  const checked = (e.target as HTMLInputElement).checked
  alternandoOcultarGrupos.value = true
  try {
    await kanban.setOcultarGrupos(props.workspaceId, checked)
  } finally {
    alternandoOcultarGrupos.value = false
  }
}

async function onFiltroCanalChange(raw: string) {
  if (!props.workspaceId || alternandoFiltroCanal.value) return
  const v = String(raw ?? '').trim()
  const canalId = v ? Number.parseInt(v, 10) : null
  const next =
    canalId != null && Number.isFinite(canalId) && canalId > 0 ? canalId : null
  if (next === filtroCanalId.value) return

  alternandoFiltroCanal.value = true
  try {
    await kanban.setFiltroCanalId(props.workspaceId, next)
  } finally {
    alternandoFiltroCanal.value = false
  }
}

onUnmounted(() => {
  if (buscaTimer) clearTimeout(buscaTimer)
})

const dragging = ref<DragState>(null)
const dragOverColumnId = ref<string | number | null>(null)
const dragOverLixeira = ref(false)

const modalColunaOpen = ref(false)
const modalColunaMode = ref<'create' | 'edit'>('create')
const colunaEmEdicao = ref<KanbanColumnData | null>(null)

const modalExcluirColuna = ref(false)
const colunaParaExcluir = ref<KanbanColumnData | null>(null)
const excluindoColuna = ref(false)

const modalExcluirCard = ref(false)
const cardParaExcluir = ref<string | null>(null)
const excluindoCard = ref(false)

const textoConfirmarExclusaoCard = computed(() => {
  const key = cardParaExcluir.value
  let nome = ''
  if (key) {
    for (const col of columns.value) {
      const card = col.cards.find((c) => c.conversa_key === key)
      if (!card) continue
      nome = card.name?.trim() || card.phone?.trim() || ''
      break
    }
  }
  const quem = nome ? ` "${nome}"` : ''
  return `A conversa${quem} e todas as mensagens serão apagadas permanentemente do banco. Esta ação não poderá ser desfeita.`
})

const ferramentaImportarRef = ref<{ abrirSeletorImportacao: () => void } | null>(null)

function aoClicarImportarContatos() {
  ferramentaImportarRef.value?.abrirSeletorImportacao()
}

const textoConfirmarExclusao = computed(() => {
  const n = colunaParaExcluir.value?.nome?.trim() || 'esta etapa'
  return `Tem certeza que deseja excluir a etapa "${n}"? Esta ação não pode ser desfeita.`
})

const gridStyle = computed(() => {
  const n = columns.value.length
  if (n <= 0) {
    return { gridTemplateColumns: 'minmax(0, 1fr)' }
  }
  return {
    gridTemplateColumns: `repeat(${n}, minmax(260px, 1fr))`,
  }
})

const titulo = computed(() => kanban.funilNome?.trim() || 'Kanban')

function abrirNovaColuna() {
  modalColunaMode.value = 'create'
  colunaEmEdicao.value = null
  modalColunaOpen.value = true
}

function irDisparoEmMassa() {
  if (!props.workspaceId) return
  void router.push(`/workspaces/${props.workspaceId}/disparo-em-massa`)
}

function onColumnEdit(col: KanbanColumnData) {
  modalColunaMode.value = 'edit'
  colunaEmEdicao.value = col
  modalColunaOpen.value = true
}

function onColumnDelete(col: KanbanColumnData) {
  const total = col.total_cards ?? col.cards.length
  if (total > 0) {
    toast.warning('Mova os cards para outra etapa antes de excluir.', { duration: 6000 })
    return
  }
  colunaParaExcluir.value = col
  modalExcluirColuna.value = true
}

function onLoadMore(colunaId: number) {
  if (!props.workspaceId) return
  void kanban.loadMoreCards({ workspaceId: props.workspaceId, colunaId })
}

function onColumnReorder(payload: {
  columnId: number
  direcao: 'esquerda' | 'direita'
}) {
  if (!props.workspaceId) return
  void kanban.reorderColumnAdjacent({
    workspaceId: props.workspaceId,
    colunaId: payload.columnId,
    direcao: payload.direcao,
  })
}

async function confirmarExcluirColuna() {
  const c = colunaParaExcluir.value
  if (!c || !props.workspaceId) {
    modalExcluirColuna.value = false
    return
  }
  excluindoColuna.value = true
  try {
    const ok = await kanban.deleteColumn({
      workspaceId: props.workspaceId,
      colunaId: c.id,
    })
    if (ok) {
      modalExcluirColuna.value = false
      colunaParaExcluir.value = null
    }
  } finally {
    excluindoColuna.value = false
  }
}

function moveCard(fromColumnId: string, cardId: string, toColumnId: string) {
  if (!fromColumnId || !toColumnId || !cardId) return
  if (fromColumnId === toColumnId) return
  if (!props.workspaceId) return

  void kanban.moveCard({
    workspaceId: props.workspaceId,
    conversaKey: cardId,
    fromColumnId,
    toColumnId,
  })
}

function onCardDragStart(payload: { cardId: string; fromColumnId: string }) {
  dragging.value = payload
  dragOverLixeira.value = false
}

function onCardDragEnd() {
  dragging.value = null
  dragOverColumnId.value = null
  dragOverLixeira.value = false
}

function parseRaw(raw: string): { fromColumnId: string; cardId: string } | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  const [fromColumnId, cardId] = s.split('::')
  if (!fromColumnId || !cardId) return null
  return { fromColumnId, cardId }
}

function onDrop(payload: { toColumnId: string | number; raw: string }) {
  if (dragOverLixeira.value) return
  const parsed = parseRaw(payload.raw)
  const state = dragging.value

  const fromColumnId = state?.fromColumnId ?? parsed?.fromColumnId ?? ''
  const cardId = state?.cardId ?? parsed?.cardId ?? ''

  const toId = String(payload.toColumnId)
  moveCard(fromColumnId, cardId, toId)
  onCardDragEnd()
}

function onLixeiraDragOver(e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  dragOverLixeira.value = true
  dragOverColumnId.value = null
}

function onLixeiraDragLeave(e: DragEvent) {
  e.preventDefault()
  const related = e.relatedTarget as Node | null
  const current = e.currentTarget as HTMLElement | null
  if (current && related && current.contains(related)) return
  dragOverLixeira.value = false
}

function onLixeiraDrop(e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()
  const raw = e.dataTransfer?.getData('text/plain') ?? ''
  const parsed = parseRaw(raw)
  const cardId = dragging.value?.cardId ?? parsed?.cardId ?? ''
  dragOverLixeira.value = false
  onCardDragEnd()
  if (!cardId) return
  cardParaExcluir.value = cardId
  modalExcluirCard.value = true
}

async function confirmarExcluirCard() {
  const key = cardParaExcluir.value
  if (!key) {
    modalExcluirCard.value = false
    return
  }
  excluindoCard.value = true
  try {
    const ok = await kanban.deleteCard(key)
    if (ok) {
      modalExcluirCard.value = false
      cardParaExcluir.value = null
    }
  } finally {
    excluindoCard.value = false
  }
}

function findCardNoPinia(conversaKey: string): KanbanCardModel | null {
  const key = conversaKey.trim()
  if (!key) return null
  for (const col of columns.value) {
    const card = col.cards.find((c) => c.conversa_key === key)
    if (card) return card
  }
  return null
}

function onCardOpen(card: KanbanCardModel) {
  const fromStore = findCardNoPinia(card.conversa_key) ?? card
  const conversaKey = fromStore.conversa_key?.trim()
  const canalId = fromStore.id_canal

  if (!conversaKey) return
  if (!props.workspaceId) {
    toast.error('Workspace não informado.')
    return
  }
  if (canalId == null || !Number.isFinite(canalId) || canalId < 1) {
    toast.error('Esta conversa não tem canal vinculado.')
    return
  }

  const kanban = useKanbanStore()
  kanban.closeInfoContatoConversa()
  useCanaisStore().setCurrentCanalId(Math.trunc(canalId))

  void navigateTo(
    `/workspaces/${props.workspaceId}/chat/${Math.trunc(canalId)}/${encodeURIComponent(conversaKey)}`,
  )
}

function onCardToggleSelected(payload: { conversa_key: string; nextSelected: boolean }) {
  toggleSelected(payload.conversa_key, payload.nextSelected)
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div class="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="font-headline text-2xl font-bold text-slate-900 dark:text-dark-on-surface">
          {{ titulo }}
        </h1>
        <p class="mt-1 text-sm text-slate-600 dark:text-dark-on-surface-variant">
          Arraste conversas entre as etapas do funil.
        </p>
      </div>
      <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
        <div class="relative w-full min-w-[12rem] sm:w-64">
          <span
            class="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2 text-[20px] text-slate-400 dark:text-slate-500"
            aria-hidden="true"
          >
            search
          </span>
          <BaseInput
            v-model="buscaInput"
            type="search"
            placeholder="Buscar por nome ou telefone…"
            autocomplete="off"
            input-class="!rounded-xl !py-2 !pl-10 !pr-9 text-sm"
            @update:model-value="agendarBusca"
          />
          <button
            v-if="buscaInput.trim()"
            type="button"
            class="absolute right-2 top-1/2 z-[1] -translate-y-1/2 rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Limpar busca"
            @click="limparBusca"
          >
            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">close</span>
          </button>
          <span
            v-if="pending && busca.trim() && !buscaInput.trim()"
            class="pointer-events-none absolute right-2 top-1/2 z-[1] -translate-y-1/2"
            aria-hidden="true"
          >
            <span class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </span>
        </div>
        <label
          class="inline-flex min-w-[11rem] flex-col gap-0.5 text-xs font-medium text-slate-600 dark:text-slate-300"
        >
          <span class="sr-only">Filtrar por canal</span>
          <select
            v-model="filtroCanalSelect"
            class="h-[42px] w-full min-w-[11rem] rounded-xl border border-outline/40 bg-white px-3 text-sm font-medium text-slate-800 shadow-sm outline-none transition-colors focus:border-primary dark:border-dark-outline/40 dark:bg-dark-surface-container-low dark:text-dark-on-surface"
            :disabled="alternandoFiltroCanal || pending"
            aria-label="Filtrar por canal"
          >
            <option value="">Todos os canais</option>
            <option
              v-for="canal in canaisDoWorkspace"
              :key="canal.id"
              :value="String(canal.id)"
            >
              {{ canal.nome?.trim() || `Canal #${canal.id}` }}
            </option>
          </select>
        </label>
        <label
          class="inline-flex cursor-pointer select-none items-center gap-2 rounded-xl border border-outline/40 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm transition-colors hover:bg-slate-50 dark:border-dark-outline/40 dark:bg-dark-surface-container-low dark:text-dark-on-surface dark:hover:bg-dark-surface-container"
          :class="alternandoOcultarGrupos ? 'pointer-events-none opacity-60' : ''"
        >
          <input
            type="checkbox"
            class="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary dark:border-slate-600"
            :checked="ocultarGrupos"
            :disabled="alternandoOcultarGrupos"
            @change="onOcultarGruposChange"
          />
          <span
            v-if="alternandoOcultarGrupos"
            class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"
            aria-hidden="true"
          />
          <span
            v-else
            class="material-symbols-outlined text-[18px] text-slate-500 dark:text-slate-400"
            aria-hidden="true"
          >
            group_off
          </span>
          Ocultar grupos
        </label>
        <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-xl border border-outline/40 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 dark:border-dark-outline/40 dark:bg-dark-surface-container-low dark:text-dark-on-surface dark:hover:bg-dark-surface-container"
          @click="aoClicarImportarContatos"
        >
          <span class="material-symbols-outlined text-[18px]" aria-hidden="true">file_upload</span>
          Importar contatos
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-xl border border-outline/40 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 dark:border-dark-outline/40 dark:bg-dark-surface-container-low dark:text-dark-on-surface dark:hover:bg-dark-surface-container"
          @click="irDisparoEmMassa"
        >
          <span class="material-symbols-outlined text-[18px]" aria-hidden="true">send</span>
          Disparo em massa
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-xl border border-outline/40 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 dark:border-dark-outline/40 dark:bg-dark-surface-container-low dark:text-dark-on-surface dark:hover:bg-dark-surface-container"
          @click="abrirNovaColuna"
        >
          <span class="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
          Nova coluna
        </button>
        </div>
      </div>
    </div>

    <ModalNovaColuna
      v-model:open="modalColunaOpen"
      :workspace-id="workspaceId"
      :mode="modalColunaMode"
      :column="colunaEmEdicao"
    />

    <ModalAlerta
      v-model:open="modalExcluirColuna"
      title="Excluir etapa"
      :texto="textoConfirmarExclusao"
      variante="perigo"
      texto-confirmar="Excluir"
      :confirmar-desabilitado="excluindoColuna"
      @confirmar="confirmarExcluirColuna"
    />

    <ModalAlerta
      v-model:open="modalExcluirCard"
      title="Excluir conversa?"
      :texto="textoConfirmarExclusaoCard"
      variante="perigo"
      texto-confirmar="Excluir"
      texto-cancelar="Cancelar"
      :confirmar-desabilitado="excluindoCard"
      :cancelar-desabilitado="excluindoCard"
      @confirmar="confirmarExcluirCard"
    />

    <InfoContatoKanban />

    <SelecaoMultiplaBar
      v-if="selectedCount > 0"
      :count="selectedCount"
      @limpar="clearSelection"
      @alterar-campos="onAlterarCampos"
    />

    <FerramentaImportarContato
      ref="ferramentaImportarRef"
      :workspace-id="workspaceId"
    />

    <div
      v-if="columns.length > 0"
      class="grid min-h-0 flex-1 gap-5 overflow-x-auto pb-2"
      :style="gridStyle"
    >
      <KanbanColumn
        v-for="(c, i) in columns"
        :key="c.id"
        :workspace-id="workspaceId"
        :column="c"
        :pode-mover-esquerda="i > 0"
        :pode-mover-direita="i < columns.length - 1"
        :reordenando="reorderingColumnId === c.id"
        :carregando-mais="!!loadingMoreByColumn[c.id]"
        :dragging-id="dragging?.cardId ?? null"
        :drag-over-column-id="dragOverColumnId"
        :selected-keys="selectedKeys"
        :force-show-checkboxes="selectionActive"
        @card-drag-start="onCardDragStart"
        @card-drag-end="onCardDragEnd"
        @column-drag-over="dragOverColumnId = $event.toColumnId"
        @column-drag-leave="dragOverColumnId = null"
        @column-drop="onDrop"
        @column-edit="onColumnEdit"
        @column-delete="onColumnDelete"
        @column-reorder="onColumnReorder"
        @load-more="onLoadMore"
        @card-open="onCardOpen"
        @card-toggle-selected="onCardToggleSelected"
      />
    </div>

    <div
      v-else
      class="flex flex-1 flex-col items-center justify-center rounded-3xl border border-dashed border-outline/40 bg-white/40 p-10 text-center dark:border-dark-outline/40 dark:bg-dark-surface-container-low/40"
    >
      <p class="text-sm font-medium text-slate-700 dark:text-dark-on-surface">
        Nenhuma coluna neste funil.
      </p>
      <p class="mt-2 max-w-md text-xs text-slate-500 dark:text-dark-on-surface-variant">
        Configure colunas em `funil_workspace_colunas` ou verifique se o workspace tem funil criado.
      </p>
    </div>

    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 translate-y-3"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-3"
    >
      <div
        v-if="dragging"
        class="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-6"
      >
        <div
          class="pointer-events-auto flex min-h-[4.5rem] w-full max-w-md items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-4 shadow-lg backdrop-blur-sm transition-colors"
          :class="
            dragOverLixeira
              ? 'border-rose-500 bg-rose-100 text-rose-800 dark:border-rose-400 dark:bg-rose-950/80 dark:text-rose-100'
              : 'border-rose-300 bg-white/95 text-rose-700 dark:border-rose-800 dark:bg-dark-surface-container-low/95 dark:text-rose-200'
          "
          role="button"
          aria-label="Solte aqui para excluir a conversa"
          @dragenter.prevent="onLixeiraDragOver"
          @dragover.prevent="onLixeiraDragOver"
          @dragleave="onLixeiraDragLeave"
          @drop.prevent="onLixeiraDrop"
        >
          <span
            class="material-symbols-outlined text-[28px]"
            :class="dragOverLixeira ? 'scale-110' : ''"
            aria-hidden="true"
          >
            delete
          </span>
          <div class="text-left">
            <p class="text-sm font-semibold">
              {{ dragOverLixeira ? 'Solte para excluir' : 'Arraste para a lixeira' }}
            </p>
            <p class="text-xs opacity-80">
              A exclusão é permanente.
            </p>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
