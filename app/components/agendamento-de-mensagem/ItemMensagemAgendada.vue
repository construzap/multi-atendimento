<script setup lang="ts">
import type { CalendarEvent } from '~/components/agendamento-de-mensagem/types'

const props = defineProps<{
  event: CalendarEvent
}>()

const chipClass = {
  primary:
    'border-l-primary-500 bg-primary-100/80 text-primary-700 dark:border-l-dark-primary dark:bg-dark-primary-container/40 dark:text-dark-on-primary-container',
  info: 'border-l-info bg-info-container/80 text-info-on-container dark:border-l-dark-info dark:bg-dark-info-container/50 dark:text-dark-on-info-container',
  tertiary:
    'border-l-tertiary bg-tertiary-fixed/60 text-on-tertiary-fixed dark:border-l-dark-tertiary dark:bg-dark-tertiary-container/40 dark:text-dark-on-tertiary-container',
} as const

const recorrenteAtivo = () => props.event.recorrente === true
</script>

<template>
  <div
    class="rounded border-l-2 p-1.5 text-[10px] font-medium leading-tight shadow-sm"
    :class="chipClass[event.color ?? 'primary']"
  >
    <span class="inline-flex items-center gap-1">
      <span class="min-w-0 truncate">{{ event.title }}</span>
      <span
        v-if="recorrenteAtivo()"
        class="inline-flex shrink-0 text-[9px] font-bold text-primary-700 dark:text-dark-on-primary-container"
        title="Recorrente"
        aria-label="Recorrente"
      >
        ⟳
      </span>
    </span>
  </div>
</template>
