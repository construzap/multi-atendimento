<script setup lang="ts">
import { computed } from 'vue'
import ItemMensagemAgendada from '~/components/agendamento-de-mensagem/ItemMensagemAgendada.vue'
import type { CalendarEvent } from '~/components/agendamento-de-mensagem/types'

const props = withDefaults(
  defineProps<{
    monthDate: Date
    monthLabel?: string
    /** Dia em destaque (ex.: selecionado na sidebar ou «hoje» quando `null` no mesmo mês). */
    highlightedDay?: number | null
    eventsByDay?: Partial<Record<number, CalendarEvent[]>>
  }>(),
  {
    eventsByDay: () => ({}),
  },
)

const emit = defineEmits<{
  dayClick: [day: number]
}>()

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const

const effectiveHighlightedDay = computed(() => {
  if (typeof props.highlightedDay === 'number') return props.highlightedDay
  const now = new Date()
  if (now.getFullYear() !== props.monthDate.getFullYear()) return undefined
  if (now.getMonth() !== props.monthDate.getMonth()) return undefined
  return now.getDate()
})

const dayCells = computed(() => {
  const y = props.monthDate.getFullYear()
  const m = props.monthDate.getMonth()
  const firstDayWeek = new Date(y, m, 1).getDay()
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const prevMonthDays = new Date(y, m, 0).getDate()

  const cells: { type: 'prev' | 'curr' | 'next'; day: number }[] = []

  for (let i = 0; i < firstDayWeek; i++) {
    const day = prevMonthDays - firstDayWeek + 1 + i
    cells.push({ type: 'prev', day })
  }
  for (let day = 1; day <= daysInMonth; day++) cells.push({ type: 'curr', day })
  let nextDay = 1
  while (cells.length < 42) {
    cells.push({ type: 'next', day: nextDay })
    nextDay++
  }
  return cells
})

function onCellClick(c: { type: string; day: number }) {
  if (c.type !== 'curr') return
  emit('dayClick', c.day)
}
</script>

<template>
  <div
    class="flex flex-1 flex-col overflow-hidden rounded-2xl border border-outline/40 bg-surface-container-lowest shadow-md dark:border-dark-outline/40 dark:bg-dark-surface dark:shadow-glow-dark"
  >
    <div
      class="grid grid-cols-7 border-b border-outline/40 bg-surface-container-high font-label text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:border-dark-outline/40 dark:bg-dark-surface-container-high dark:text-dark-on-surface-variant"
    >
      <div v-for="d in WEEKDAYS" :key="d" class="py-4 text-center">
        {{ d }}
      </div>
    </div>

    <div class="grid flex-1 grid-cols-7 overflow-y-auto pb-4">
      <div
        v-for="(c, idx) in dayCells"
        :key="`${c.type}-${c.day}-${idx}`"
        class="min-h-[120px] overflow-hidden border-b border-outline/25 p-3 transition-colors dark:border-dark-outline/25"
        :class="[
          (idx + 1) % 7 !== 0 ? 'border-r border-outline/25 dark:border-dark-outline/25' : '',
          c.type === 'curr'
            ? 'cursor-pointer text-on-surface hover:bg-surface-container-low dark:text-dark-on-surface dark:hover:bg-dark-surface-container'
            : 'bg-surface-dim/40 text-on-surface-variant/70 dark:bg-dark-surface-dim/80 dark:text-dark-on-surface-variant/50',
          c.type === 'curr' &&
          effectiveHighlightedDay != null &&
          c.day === effectiveHighlightedDay
            ? 'bg-primary-50 ring-1 ring-inset ring-primary-400/30 dark:bg-dark-surface-container-high dark:ring-dark-primary/35'
            : '',
        ]"
        @click="onCellClick(c)"
      >
        <div v-if="c.type === 'curr' && effectiveHighlightedDay != null && c.day === effectiveHighlightedDay" class="mb-2">
          <span
            class="flex h-7 w-7 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white dark:bg-dark-primary dark:text-dark-on-primary"
          >
            {{ c.day }}
          </span>
        </div>
        <div v-else :class="c.type === 'curr' ? 'text-on-surface-variant dark:text-dark-on-surface-variant' : ''">
          {{ c.day }}
        </div>

        <div v-if="c.type === 'curr' && (eventsByDay[c.day]?.length ?? 0) > 0" class="mt-2 space-y-1">
          <ItemMensagemAgendada
            v-for="ev in (eventsByDay[c.day] ?? []).slice(0, 3)"
            :key="ev.id"
            :event="ev"
          />
          <div
            v-if="(eventsByDay[c.day]?.length ?? 0) > 3"
            class="pt-0.5 text-[10px] font-medium text-on-surface-variant dark:text-dark-on-surface-variant"
          >
            +{{ (eventsByDay[c.day]?.length ?? 0) - 3 }} mais
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
