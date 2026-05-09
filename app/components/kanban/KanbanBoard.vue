<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import KanbanColumn from './KanbanColumn.vue'
import { useKanbanStore } from '~/stores/kanban'

type DragState = {
  cardId: string
  fromColumnId: string
} | null

const props = defineProps<{
  workspaceId: number
}>()

const kanban = useKanbanStore()
const { columns } = storeToRefs(kanban)

const dragging = ref<DragState>(null)
const dragOverColumnId = ref<string | number | null>(null)

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
      <div class="text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
        Dica: segure e arraste pelo card
      </div>
    </div>

    <div
      v-if="columns.length > 0"
      class="grid min-h-0 flex-1 gap-5 overflow-x-auto pb-2"
      :style="gridStyle"
    >
      <KanbanColumn
        v-for="c in columns"
        :key="c.id"
        :column="c"
        :dragging-id="dragging?.cardId ?? null"
        :drag-over-column-id="dragOverColumnId"
        @card-drag-start="onCardDragStart"
        @card-drag-end="onCardDragEnd"
        @column-drag-over="dragOverColumnId = $event.toColumnId"
        @column-drag-leave="dragOverColumnId = null"
        @column-drop="onDrop"
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
