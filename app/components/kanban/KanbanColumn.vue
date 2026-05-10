<script setup lang="ts">
import { computed } from 'vue'
import type { KanbanColumn } from '#shared/types/kanban'
import BaseDropdown from '~/components/ui/BaseDropdown.vue'
import KanbanCard from './KanbanCard.vue'

const props = defineProps<{
  column: KanbanColumn
  draggingId?: string | null
  dragOverColumnId?: string | number | null
  podeMoverEsquerda?: boolean
  podeMoverDireita?: boolean
  reordenando?: boolean
}>()

const emit = defineEmits<{
  columnDrop: [payload: { toColumnId: string | number; raw: string }]
  columnDragOver: [payload: { toColumnId: string | number }]
  columnDragLeave: [payload: { toColumnId: string | number }]
  cardDragStart: [payload: { cardId: string; fromColumnId: string }]
  cardDragEnd: []
  columnEdit: [column: KanbanColumn]
  columnDelete: [column: KanbanColumn]
  columnReorder: [payload: { columnId: number; direcao: 'esquerda' | 'direita' }]
}>()

function onEditar(close: () => void) {
  close()
  emit('columnEdit', props.column)
}

function onExcluir(close: () => void) {
  close()
  emit('columnDelete', props.column)
}

function emitReorder(direcao: 'esquerda' | 'direita') {
  if (props.reordenando) return
  emit('columnReorder', { columnId: props.column.id, direcao })
}

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
    <header class="mb-4 flex items-start justify-between gap-2">
      <div class="min-w-0 flex-1">
        <div class="flex items-start gap-2">
          <span
            class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
            :style="dotStyle"
            aria-hidden="true"
          />
          <h2
            class="min-w-0 flex-1 break-normal font-headline text-sm font-bold leading-snug text-slate-900 dark:text-dark-on-surface"
            lang="pt-BR"
          >
            {{ column.nome }}
          </h2>
        </div>
      </div>

      <div class="flex shrink-0 items-start gap-1 pt-0.5">
        <div
          v-if="podeMoverEsquerda || podeMoverDireita"
          class="flex shrink-0 items-center gap-0.5"
          @click.stop
          @mousedown.stop
        >
          <button
            v-if="podeMoverEsquerda"
            type="button"
            class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-white/70 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800/80"
            :disabled="reordenando"
            aria-label="Mover etapa para a esquerda"
            @click="emitReorder('esquerda')"
          >
            <span class="material-symbols-outlined text-[20px]" aria-hidden="true">chevron_left</span>
          </button>
          <button
            v-if="podeMoverDireita"
            type="button"
            class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-white/70 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800/80"
            :disabled="reordenando"
            aria-label="Mover etapa para a direita"
            @click="emitReorder('direita')"
          >
            <span class="material-symbols-outlined text-[20px]" aria-hidden="true">chevron_right</span>
          </button>
        </div>

        <span
          class="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-bold text-slate-700 shadow-sm dark:bg-slate-800/70 dark:text-slate-200"
        >
          {{ column.cards.length }}
        </span>

        <div class="shrink-0" @click.stop @mousedown.stop>
          <BaseDropdown
            title="Etapa"
            align="right"
            side="bottom"
            panel-class="w-52 min-w-[12rem] max-w-[calc(100vw-2rem)]"
          >
            <template #trigger>
              <span
                class="flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-white/60 dark:hover:bg-slate-800/80"
              >
                <span
                  class="material-symbols-outlined text-[22px] text-slate-600 dark:text-slate-400"
                  aria-hidden="true"
                >
                  settings
                </span>
                <span class="sr-only">Configurações da etapa</span>
              </span>
            </template>

            <template #default="{ close }">
              <button
                type="button"
                role="menuitem"
                class="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-high dark:text-dark-on-surface dark:hover:bg-dark-surface-container-high"
                @click="onEditar(close)"
              >
                <span
                  class="material-symbols-outlined text-[20px] text-on-surface-variant dark:text-dark-on-surface-variant"
                  aria-hidden="true"
                >
                  edit
                </span>
                Editar
              </button>
              <button
                type="button"
                role="menuitem"
                class="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                @click="onExcluir(close)"
              >
                <span class="material-symbols-outlined text-[20px]" aria-hidden="true">
                  delete
                </span>
                Excluir
              </button>
            </template>
          </BaseDropdown>
        </div>
      </div>
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
