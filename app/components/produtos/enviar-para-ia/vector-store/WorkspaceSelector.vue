<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'

const route = useRoute()
const workspacesStore = useWorkspacesStore()
const { currentWorkspaceId, items, pending, error } = storeToRefs(workspacesStore)

const workspaceId = computed(() => {
  const raw = currentWorkspaceId.value ?? String(route.params.id ?? '')
  const n = Number.parseInt(String(raw).trim(), 10)
  if (!Number.isFinite(n) || n < 1) return null
  return n
})

const workspaceAtual = computed(() => {
  const id = workspaceId.value
  if (id == null) return null
  return items.value.find((w) => w.id === id) ?? null
})

onMounted(async () => {
  if (items.value.length || pending.value) return
  try {
    await workspacesStore.ensureAllLoaded()
  } catch {
    // erro exposto em workspacesStore.error
  }
})
</script>

<template>
  <section
    class="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
  >
    <h2 class="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Workspace</h2>

    <p v-if="pending" class="text-sm text-zinc-500 dark:text-zinc-400">Carregando workspace…</p>
    <p v-else-if="error" class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>
    <p v-else-if="workspaceId == null" class="text-sm text-zinc-500 dark:text-zinc-400">
      Nenhum workspace selecionado.
    </p>
    <div v-else class="text-sm text-zinc-700 dark:text-zinc-300">
      <p class="font-medium text-zinc-900 dark:text-zinc-100">
        {{ workspaceAtual?.nome ?? `Workspace ${workspaceId}` }}
      </p>
      <p class="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">ID {{ workspaceId }}</p>
    </div>
  </section>
</template>
