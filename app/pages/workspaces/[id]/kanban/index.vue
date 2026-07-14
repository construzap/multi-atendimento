<script setup lang="ts">
import { computed, watch } from 'vue'
import { useKanbanStore } from '~/stores/kanban'

definePageMeta({
  layout: 'workspace',
})

const route = useRoute()
const kanban = useKanbanStore()

const workspaceId = computed(() => {
  const raw = route.params.id
  const n = typeof raw === 'string' ? Number.parseInt(raw, 10) : Number(raw)
  return Number.isFinite(n) && n > 0 ? n : 0
})

/** Redireciona `/workspaces/:id/kanban` → `/workspaces/:id/kanban/:funilId` (funil ordem 1). */
watch(
  workspaceId,
  async (id) => {
    if (!import.meta.client || !id) return
    try {
      await kanban.ensureFunisLoaded(id)
      const principal =
        kanban.funis.find((f) => f.ordem === 1) ?? kanban.funis[0] ?? null
      if (principal?.id) {
        await navigateTo(`/workspaces/${id}/kanban/${principal.id}`, { replace: true })
        return
      }
    } catch {
      /* toast já tratado no store */
    }
    await navigateTo(`/workspaces/${id}`, { replace: true })
  },
  { immediate: true },
)
</script>

<template>
  <div class="flex min-h-[40vh] items-center justify-center p-6">
    <div class="flex flex-col items-center gap-3 text-slate-600 dark:text-dark-on-surface-variant">
      <span
        class="inline-block h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent"
        aria-hidden="true"
      />
      <p class="text-sm font-medium">Abrindo funil…</p>
    </div>
  </div>
</template>
