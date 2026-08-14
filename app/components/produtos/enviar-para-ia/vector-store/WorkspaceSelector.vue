<script setup lang="ts">
import { computed } from 'vue'
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
  <section class="rounded-lg border border-outline/30 bg-surface-container-lowest p-4 shadow-sm">
    <h2 class="mb-3 text-sm font-semibold text-on-surface">Workspace</h2>

    <p v-if="pending" class="text-sm text-on-surface-variant">Carregando workspace…</p>
    <p v-else-if="error" class="text-sm text-danger">{{ error }}</p>
    <p v-else-if="workspaceId == null" class="text-sm text-on-surface-variant">
      Nenhum workspace selecionado.
    </p>
    <div v-else class="text-sm text-on-surface">
      <p class="font-medium text-on-surface">
        {{ workspaceAtual?.nome ?? `Workspace ${workspaceId}` }}
      </p>
      <p class="mt-0.5 text-xs text-on-surface-variant">ID {{ workspaceId }}</p>
    </div>
  </section>
</template>
