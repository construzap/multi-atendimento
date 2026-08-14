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
  <section class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
    <h2 class="mb-3 text-sm font-semibold text-gray-700">Workspace</h2>

    <p v-if="pending" class="text-sm text-gray-500">Carregando workspace…</p>
    <p v-else-if="error" class="text-sm text-red-600">{{ error }}</p>
    <p v-else-if="workspaceId == null" class="text-sm text-gray-500">
      Nenhum workspace selecionado.
    </p>
    <div v-else class="text-sm text-gray-700">
      <p class="font-medium text-gray-900">
        {{ workspaceAtual?.nome ?? `Workspace ${workspaceId}` }}
      </p>
      <p class="mt-0.5 text-xs text-gray-500">ID {{ workspaceId }}</p>
    </div>
  </section>
</template>
