<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import type { KanbanColumn as KanbanColumnData } from '#shared/types/kanban'
import BaseInput from '~/components/BaseInput.vue'
import KanbanColumn from './KanbanColumn.vue'
import ModalNovaColuna from './ModalNovaColuna.vue'
import InfoContatoKanban from './InfoContatoKanban/InfoContatoKanban.vue'
import ModalAlerta from '~/components/ModalAlerta.vue'
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
const { columns, reorderingColumnId, loadingMoreByColumn, busca, pending } = storeToRefs(kanban)

const buscaInput = ref('')
let buscaTimer: ReturnType<typeof setTimeout> | null = null

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

onUnmounted(() => {
  if (buscaTimer) clearTimeout(buscaTimer)
})

const dragging = ref<DragState>(null)
const dragOverColumnId = ref<string | number | null>(null)

const modalColunaOpen = ref(false)
const modalColunaMode = ref<'create' | 'edit'>('create')
const colunaEmEdicao = ref<KanbanColumnData | null>(null)

const modalExcluirColuna = ref(false)
const colunaParaExcluir = ref<KanbanColumnData | null>(null)
const excluindoColuna = ref(false)

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
}

function onCardDragEnd() {
  dragging.value = null
  dragOverColumnId.value = null
}

function parseRaw(raw: string): { fromColumnId: string; cardId: string } | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  const [fromColumnId, cardId] = s.split('::')
  if (!fromColumnId || !cardId) return null
  return { fromColumnId, cardId }
}

function onDrop(payload: { toColumnId: string | number; raw: string }) {
  const parsed = parseRaw(payload.raw)
  const state = dragging.value

  const fromColumnId = state?.fromColumnId ?? parsed?.fromColumnId ?? ''
  const cardId = state?.cardId ?? parsed?.cardId ?? ''

  const toId = String(payload.toColumnId)
  moveCard(fromColumnId, cardId, toId)
  onCardDragEnd()
}

function onCardOpen(card: { conversa_key: string }) {
  kanban.openInfoContatoConversa(card.conversa_key)
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
        <div class="flex flex-wrap items-center gap-2">
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

    <InfoContatoKanban />

    <div
      v-if="columns.length > 0"
      class="grid min-h-0 flex-1 gap-5 overflow-x-auto pb-2"
      :style="gridStyle"
    >
      <KanbanColumn
        v-for="(c, i) in columns"
        :key="c.id"
        :column="c"
        :pode-mover-esquerda="i > 0"
        :pode-mover-direita="i < columns.length - 1"
        :reordenando="reorderingColumnId === c.id"
        :carregando-mais="!!loadingMoreByColumn[c.id]"
        :dragging-id="dragging?.cardId ?? null"
        :drag-over-column-id="dragOverColumnId"
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
  </div>
</template>
