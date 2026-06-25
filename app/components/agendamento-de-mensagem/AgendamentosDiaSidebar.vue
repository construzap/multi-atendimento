<script setup lang="ts">
import BaseButton from '~/components/BaseButton.vue'
import ItemAgendamentoDia from '~/components/agendamento-de-mensagem/ItemAgendamentoDia.vue'
import type { AgendamentoDiaItem } from '~/components/agendamento-de-mensagem/types'

defineProps<{
  open: boolean
  day: number | null
  monthDate: Date
  items: AgendamentoDiaItem[]
  workspaceId: number | null
}>()

const emit = defineEmits<{
  close: []
  createClick: []
  editClick: [item: AgendamentoDiaItem]
  excluido: [item: AgendamentoDiaItem]
}>()

function formatDayLabel(day: number, monthDate: Date) {
  const d = new Date(monthDate.getFullYear(), monthDate.getMonth(), day)
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  }).format(d)
}
</script>

<template>
  <aside
    v-if="open && day != null"
    class="hidden w-[360px] shrink-0 lg:flex xl:w-[420px]"
  >
    <div
      class="flex w-full flex-col overflow-hidden rounded-2xl border border-outline/40 bg-surface-container-lowest shadow-md dark:border-dark-outline/40 dark:bg-dark-surface dark:shadow-glow-dark"
    >
      <div class="border-b border-outline/40 bg-surface-container-high p-4 dark:border-dark-outline/40 dark:bg-dark-surface-container-high">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-xs font-medium uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
              Agendamentos do dia
            </p>
            <h3 class="truncate text-sm font-semibold text-on-surface dark:text-dark-on-surface">
              {{ formatDayLabel(day, monthDate) }}
            </h3>
            <p class="mt-0.5 text-[11px] text-on-surface-variant dark:text-dark-on-surface-variant">
              {{ items.length }} agendamento(s)
            </p>
          </div>
          <button
            type="button"
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-highest hover:text-on-surface dark:text-dark-on-surface-variant dark:hover:bg-dark-surface-container-highest dark:hover:text-dark-on-surface"
            aria-label="Fechar"
            @click="emit('close')"
          >
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <BaseButton variant="info" class="mt-3" @click="emit('createClick')">
          <span class="inline-flex items-center justify-center gap-2">
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Criar novo agendamento
          </span>
        </BaseButton>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto p-4">
        <div class="space-y-2">
          <div
            v-if="items.length === 0"
            class="rounded-xl border border-outline/40 bg-surface-container p-4 text-sm text-on-surface-variant dark:border-dark-outline/40 dark:bg-dark-surface-container dark:text-dark-on-surface-variant"
          >
            Nenhum agendamento para este dia.
          </div>
          <template v-else>
            <ItemAgendamentoDia
              v-for="it in items"
              :key="it.id"
              :item="it"
              :workspace-id="workspaceId ?? 0"
              :on-edit="(row) => emit('editClick', row)"
              @excluido="(row) => emit('excluido', row)"
            />
          </template>
        </div>
      </div>
    </div>
  </aside>
</template>
