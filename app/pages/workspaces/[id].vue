<script setup lang="ts">
import type { Workspace } from '#shared/types/workspace'

definePageMeta({
  layout: 'workspace'
})

const route = useRoute()
const workspaces = useWorkspacesStore()

function parsePositiveInt(raw: unknown): number | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  const n = Number.parseInt(s, 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return null
  if (String(n) !== s) return null
  return n
}

const workspaceId = computed(() => parsePositiveInt(route.params.id))

// 1) Busca workspaces (SSR-friendly) se ainda não estiverem no Pinia.
if (import.meta.server && workspaces.items.length === 0) {
  const ufetch = useRequestFetch()
  try {
    const data = await ufetch<Workspace[]>('/api/workspaces', { method: 'GET' })
    workspaces.items = data ?? []
  } catch {
    // Se não autenticado, o middleware de auth do supabase já deve redirecionar.
    // Aqui só evitamos quebrar a renderização.
  }
}

// 2) Pega o workspace pela rota e 3) valida se pertence ao user.
watch(
  workspaceId,
  async (id) => {
    if (id == null) {
      await navigateTo('/', { replace: true })
      return
    }

    // Client: se veio direto pela URL e o Pinia ainda está vazio, carrega com auth.
    if (import.meta.client && workspaces.items.length === 0 && !workspaces.pending) {
      const ufetch = useRequestFetch()
      try {
        const data = await ufetch<Workspace[]>('/api/workspaces', { method: 'GET' })
        workspaces.items = data ?? []
      } catch {
        workspaces.items = []
      }
    }

    const belongs = workspaces.items.some((w) => w.id === id)
    if (!belongs) {
      workspaces.setCurrentWorkspaceId(null)
      await navigateTo('/', { replace: true })
      return
    }

    workspaces.setCurrentWorkspaceId(String(id))
  },
  { immediate: true }
)
</script>

<template>
  <NuxtPage :key="route.fullPath" />
</template>

