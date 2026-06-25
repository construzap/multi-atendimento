<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import ModalAddWorkspace from '~/components/workspaces/ModalAddWorkspace.vue'
import WorkspaceAddCard from '~/components/workspaces/WorkspaceAddCard.vue'
import WorkspaceCard from '~/components/workspaces/WorkspaceCard.vue'
import type { Workspace } from '#shared/types/workspace'

const query = ref('')
const addOpen = ref(false)

const store = useWorkspacesStore()

onMounted(() => {
  // Fora de /workspaces/:id, então não há workspace “atual”
  store.setCurrentWorkspaceId(null)
  if (!store.items.length && !store.pending) {
    store.ensureAllLoaded().catch(() => {})
  }
})

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'W'
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase().slice(0, 2)
}

function gradientById(id: number): string {
  const g = [
    'bg-gradient-to-br from-info to-tertiary shadow-[0_10px_30px_rgba(0,99,154,0.25)]',
    'bg-gradient-to-br from-tertiary to-tertiary-muted shadow-[0_10px_30px_rgba(0,136,212,0.25)]',
    'bg-gradient-to-br from-warning to-secondary-accent shadow-[0_10px_30px_rgba(230,81,0,0.25)]',
    'bg-gradient-to-br from-success to-success shadow-[0_10px_30px_rgba(46,125,50,0.22)]',
    'bg-gradient-to-br from-primary-500 to-primary-700 shadow-[0_10px_30px_rgba(26,123,45,0.25)]', //aquifoimodificadocor
    'bg-gradient-to-br from-danger to-error shadow-[0_10px_30px_rgba(186,26,26,0.20)]',
  ] as const
  return g[Math.abs(id) % g.length] ?? g[0]
}

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  const items = store.items
  if (!q) return items
  return items.filter((w) => `${w.nome} ${w.descricao ?? ''} ${w.id}`.toLowerCase().includes(q))
})

async function onSelectWorkspace(workspaceId: string) {
  store.setCurrentWorkspaceId(workspaceId)
  await navigateTo(`/workspaces/${workspaceId}/chat`)
}
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-8 md:px-6">
    <header class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="font-headline text-2xl font-bold text-on-surface dark:text-dark-on-surface">
          Workspaces
        </h1>
        <p class="mt-1 font-body text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
          Gerencie seus ambientes de trabalho e equipes
        </p>
      </div>

      <div class="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
        <div class="relative w-full sm:w-80">
          <div class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant dark:text-dark-on-surface-variant">
            <svg class="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" stroke-linecap="round" />
            </svg>
          </div>
          <input
            v-model="query"
            type="text"
            placeholder="Buscar workspace..."
            class="w-full rounded-xl border border-outline/40 bg-surface-container-high py-2.5 pl-10 pr-4 text-sm text-on-surface placeholder:text-on-surface-variant/80 shadow-sm transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 dark:border-dark-outline/40 dark:bg-dark-surface-container-high dark:text-dark-on-surface dark:placeholder:text-dark-on-surface-variant/70"
          />
        </div>
      </div>
    </header>

    <section class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <WorkspaceAddCard @click="addOpen = true" />

      <div
        v-if="store.pending"
        class="col-span-full rounded-2xl border border-outline/40 bg-surface-container-lowest p-6 text-sm text-on-surface-variant dark:border-dark-outline/40 dark:bg-dark-surface-container-low dark:text-dark-on-surface-variant"
      >
        Carregando workspaces...
      </div>

      <div
        v-else-if="store.error"
        class="col-span-full rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700"
      >
        {{ store.error }}
      </div>

      <div
        v-else-if="!store.items.length"
        class="col-span-full rounded-2xl border border-outline/40 bg-surface-container-lowest p-6 text-sm text-on-surface-variant dark:border-dark-outline/40 dark:bg-dark-surface-container-low dark:text-dark-on-surface-variant"
      >
        Você ainda não tem workspaces. Clique em “Criar Workspace” para adicionar o primeiro.
      </div>

      <WorkspaceCard
        v-for="w in filtered"
        v-else
        :key="w.id"
        :id="String(w.id)"
        :name="w.nome"
        :description="w.descricao ?? ''"
        :created-at="w.created_at"
        :avatar-text="initials(w.nome)"
        :avatar-gradient-class="gradientById(w.id)"
        status="ativo"
        @select="onSelectWorkspace"
      />
    </section>

    <ModalAddWorkspace v-model:open="addOpen" />
  </div>
</template>

