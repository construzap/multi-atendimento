<script setup lang="ts">
import { computed } from 'vue'
import BaseAvatar from '~/components/BaseAvatar.vue'
import type { KanbanCard as KanbanCardModel } from '#shared/types/kanban'

const props = defineProps<{
  card: KanbanCardModel
  columnId: number | string
  draggingId?: string | null
}>()

const emit = defineEmits<{
  cardDragStart: [payload: { cardId: string; fromColumnId: string }]
  cardDragEnd: []
}>()

const titleDisplay = computed(() => {
  const n = props.card.name?.trim()
  if (n) return n
  const ph = props.card.phone?.trim()
  if (ph) return ph
  return props.card.conversa_key
})

function onDragStart(e: DragEvent) {
  if (!e.dataTransfer) return
  e.dataTransfer.effectAllowed = 'move'
  const col = String(props.columnId)
  e.dataTransfer.setData('text/plain', `${col}::${props.card.conversa_key}`)
  emit('cardDragStart', { cardId: props.card.conversa_key, fromColumnId: col })
}

/** Sem preventDefault no card sob o cursor, o browser bloqueia o drop na coluna. */
function onDragOverCard(e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
}

function onDragEnd() {
  emit('cardDragEnd')
}

function initials(name: string): string {
  const parts = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  const a = parts[0]?.[0] ?? '?'
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] : ''
  return `${a}${b}`.toUpperCase()
}

/** 1=baixa, 2=média, 3=alta — outros/null → sem badge. */
function priorityUi(p: number | null): { dot: string; text: string; pill: string } | null {
  if (p == null || !Number.isFinite(p)) return null
  if (p === 3) {
    return {
      dot: 'bg-rose-500',
      text: 'Alta',
      pill: 'text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-200 dark:bg-rose-900/20 dark:border-rose-800/40',
    }
  }
  if (p === 2) {
    return {
      dot: 'bg-amber-500',
      text: 'Média',
      pill: 'text-amber-800 bg-amber-50 border-amber-200 dark:text-amber-200 dark:bg-amber-900/20 dark:border-amber-800/40',
    }
  }
  if (p === 1) {
    return {
      dot: 'bg-sky-500',
      text: 'Baixa',
      pill: 'text-sky-800 bg-sky-50 border-sky-200 dark:text-sky-200 dark:bg-sky-900/20 dark:border-sky-800/40',
    }
  }
  return null
}

const timeLabel = computed(() => {
  const iso = props.card.updated_at
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''

  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const sec = Math.floor(diffMs / 1000)
  const min = Math.floor(sec / 60)
  const hr = Math.floor(min / 60)
  const day = Math.floor(hr / 24)

  if (sec < 60) return 'agora'
  if (min < 60) return `${min} min`
  if (hr < 24) return `${hr} h`
  if (day < 7) return `${day} d`

  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
})
</script>

<template>
  <article
    class="group rounded-2xl border border-outline/40 bg-white p-4 shadow-sm transition-all hover:-translate-y-[1px] hover:shadow-md dark:border-dark-outline/40 dark:bg-dark-surface-container-low"
    :class="draggingId === card.conversa_key ? 'opacity-60 ring-2 ring-primary/25' : ''"
    draggable="true"
    @dragstart="onDragStart"
    @dragover="onDragOverCard"
    @dragend="onDragEnd"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="flex min-w-0 items-start gap-3">
        <BaseAvatar
          :src="card.photo ?? null"
          :alt="titleDisplay"
          :text="initials(titleDisplay)"
          :size="40"
          variant="circle"
          class="shrink-0"
        />
        <div class="min-w-0">
          <h3 class="truncate font-headline text-sm font-bold text-slate-900 dark:text-dark-on-surface">
            {{ titleDisplay }}
          </h3>
          <p class="mt-0.5 truncate font-mono text-[11px] text-slate-500 dark:text-dark-on-surface-variant">
            {{ card.phone ?? '—' }}
          </p>
        </div>
      </div>

      <div v-if="priorityUi(card.prioridade)" class="shrink-0">
        <span
          class="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold"
          :class="priorityUi(card.prioridade)!.pill"
        >
          <span class="h-1.5 w-1.5 rounded-full" :class="priorityUi(card.prioridade)!.dot" aria-hidden="true" />
          {{ priorityUi(card.prioridade)!.text }}
        </span>
      </div>
    </div>

    <p v-if="card.preview" class="mt-3 line-clamp-2 text-xs text-slate-600 dark:text-dark-on-surface-variant">
      {{ card.preview }}
    </p>

    <div class="mt-4 flex items-center justify-end gap-3">
      <span class="shrink-0 text-[11px] text-slate-400 dark:text-dark-on-surface-variant">
        {{ timeLabel }}
      </span>
    </div>
  </article>
</template>
