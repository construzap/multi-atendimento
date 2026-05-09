<script setup lang="ts">
import { computed } from 'vue'
import type { KanbanColumn } from '#shared/types/kanban'
import KanbanCard from './KanbanCard.vue'

const props = defineProps<{
  column: KanbanColumn
  draggingId?: string | null
  dragOverColumnId?: string | number | null
}>()

const emit = defineEmits<{
  columnDrop: [payload: { toColumnId: string | number; raw: string }]
  columnDragOver: [payload: { toColumnId: string | number }]
  columnDragLeave: [payload: { toColumnId: string | number }]
  cardDragStart: [payload: { cardId: string; fromColumnId: string }]
  cardDragEnd: []
}>()

const dotStyle = computed(() => {
  const c = props.column.cor?.trim()
  if (c) return { backgroundColor: c }
  return { backgroundColor: 'rgb(148 163 184)' }
})

const columnSurfaceStyle = computed(() => {
  const c = props.column.cor?.trim()
  if (!c) return {}
  const hex = /^#([0-9a-fA-F]{6})$/.test(c) ? c : null
  if (hex) {
    return { backgroundColor: `${hex}18` }
  }
  return { backgroundColor: `${c}18` }
})

const isDragOver = computed(
  () => props.dragOverColumnId != null && String(props.dragOverColumnId) === String(props.column.id),
)

function onDragOver(e: DragEvent) {
  e.preventDefault()
  emit('columnDragOver', { toColumnId: props.column.id })
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
}

function onDragLeave(e: DragEvent) {
  const el = e.currentTarget
  const related = e.relatedTarget
  if (
    el instanceof HTMLElement &&
    related instanceof Node &&
    el.contains(related)
  ) {
    return
  }
  emit('columnDragLeave', { toColumnId: props.column.id })
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  const raw = e.dataTransfer?.getData('text/plain') ?? ''
  emit('columnDrop', { toColumnId: props.column.id, raw })
}
</script>

<template>
  <!-- drop/dragover na section inteira: sobre outro card o evento não chega no inner div -->
  <section
    class="flex h-full min-h-0 flex-col rounded-3xl p-4 dark:bg-slate-900/30"
    :style="columnSurfaceStyle"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <header class="mb-4 flex items-center justify-between gap-3">
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <span class="h-2.5 w-2.5 shrink-0 rounded-full" :style="dotStyle" aria-hidden="true" />
          <h2 class="truncate font-headline text-sm font-bold text-slate-900 dark:text-dark-on-surface">
            {{ column.nome }}
          </h2>
        </div>
      </div>

      <span
        class="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-bold text-slate-700 shadow-sm dark:bg-slate-800/70 dark:text-slate-200"
      >
        {{ column.cards.length }}
      </span>
    </header>

    <div
      class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto rounded-2xl p-1"
      :class="isDragOver ? 'ring-2 ring-primary/25' : ''"
      role="list"
      :aria-label="`Coluna ${column.nome}`"
      @dragenter="onDragOver"
      @dragover="onDragOver"
      @drop="onDrop"
    >
      <KanbanCard
        v-for="c in column.cards"
        :key="c.conversa_key"
        :card="c"
        :column-id="column.id"
        :dragging-id="draggingId ?? null"
        @card-drag-start="emit('cardDragStart', $event)"
        @card-drag-end="emit('cardDragEnd')"
      />

      <div
        v-if="column.cards.length === 0"
        class="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-outline/30 bg-white/50 p-6 text-center text-xs text-slate-500 dark:border-dark-outline/30 dark:bg-slate-900/20 dark:text-dark-on-surface-variant"
        @dragenter="onDragOver"
        @dragover="onDragOver"
        @drop="onDrop"
      >
        Solte um card aqui
      </div>
    </div>
  </section>
</template>
