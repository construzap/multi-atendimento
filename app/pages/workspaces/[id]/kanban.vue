<script setup lang="ts">
import { computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import KanbanBoard from '~/components/kanban/KanbanBoard.vue'
import { useKanbanStore } from '~/stores/kanban'

definePageMeta({
  layout: 'workspace',
})

const route = useRoute()
const kanban = useKanbanStore()
const { pending, error } = storeToRefs(kanban)

const workspaceId = computed(() => {
  const raw = route.params.id
  const n = typeof raw === 'string' ? Number.parseInt(raw, 10) : Number(raw)
  return Number.isFinite(n) && n > 0 ? n : 0
})

/**
 * Não chamar GET /api/kanban no SSR: o $fetch do Nitro não envia cookies da sessão
 * por padrão → 401 "Não autenticado" e o board não carrega (nada a ver com drag-and-drop).
 */
watch(
  workspaceId,
  (id) => {
    if (!import.meta.client || !id) return
    void kanban.fetchBoard(id)
    void useCanaisStore().fetchCanais(id).catch(() => {})
  },
  { immediate: true },
)
</script>

<template>
  <div class="relative min-h-[100dvh] w-full p-4 md:p-6">
    <div
      class="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-sky-50 via-white to-emerald-50 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900"
    />

    <div v-if="pending && kanban.columns.length === 0" class="flex min-h-[40vh] items-center justify-center">
      <div class="flex flex-col items-center gap-3 text-slate-600 dark:text-dark-on-surface-variant">
        <span
          class="inline-block h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent"
          aria-hidden="true"
        />
        <p class="text-sm font-medium">Carregando Kanban…</p>
      </div>
    </div>

    <div v-else-if="error && kanban.columns.length === 0" class="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200">
      {{ error }}
    </div>

    <KanbanBoard v-else :workspace-id="workspaceId" />
  </div>
</template>
