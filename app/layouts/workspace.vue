<script setup lang="ts">
import { computed, watch } from 'vue'

type NavItem = {
  label: string
  to: string
  icon: 'dashboard' | 'chat' | 'contato' | 'canais' | 'configuracoes'
}

const route = useRoute()
const workspaces = useWorkspacesStore()

// Mantém o Pinia em sync quando usuário entra via URL direta.
watch(
  () => route.params.id,
  (id) => {
    const next = id === undefined ? null : String(id)
    if (next && workspaces.currentWorkspaceId !== next) {
      workspaces.setCurrentWorkspaceId(next)
    }
  },
  { immediate: true }
)

const workspaceId = computed(() => workspaces.currentWorkspaceId ?? String(route.params.id ?? ''))
const base = computed(() => `/workspaces/${workspaceId.value}`)

const items = computed<NavItem[]>(() => [
  { label: 'Dashboard', to: `${base.value}/dashboard`, icon: 'dashboard' },
  { label: 'Chat', to: `${base.value}/chat`, icon: 'chat' },
  { label: 'Contato', to: `${base.value}/contato`, icon: 'contato' },
  { label: 'Canais', to: `${base.value}/canais`, icon: 'canais' },
  { label: 'Configurações', to: `${base.value}/configuracoes`, icon: 'configuracoes' }
])

function isActive(to: string) {
  return route.path === to
}
</script>

<template>
  <div class="flex h-screen w-full overflow-hidden bg-background text-on-surface transition-colors dark:bg-dark-background dark:text-dark-on-surface">
    <aside class="flex w-64 shrink-0 flex-col bg-gray-900 text-gray-100">
      <!-- Header -->
      <div class="border-b border-gray-800 p-6">
        <div class="flex items-center space-x-3">
          <div
            class="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 shadow-lg shadow-primary-500/20"
            aria-hidden="true"
          >
            <svg class="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path
                d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H7l-4 3 1.2-4.8A8.5 8.5 0 1 1 21 11.5Z"
                stroke-linejoin="round"
              />
            </svg>
          </div>
          <div>
            <h1 class="text-lg font-bold tracking-tight text-white">Multi Chat</h1>
            <p class="text-xs font-medium text-gray-400">Sistema de Atendimento</p>
          </div>
        </div>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 space-y-1 overflow-y-auto p-4">
        <NuxtLink
          v-for="it in items"
          :key="it.to"
          :to="it.to"
          class="group flex items-center space-x-3 rounded-xl px-4 py-3 transition-all"
          :class="
            isActive(it.to)
              ? 'bg-gray-800 text-primary-500 shadow-md shadow-gray-900/50'
              : 'text-gray-300 hover:bg-gray-800 hover:text-white'
          "
        >
          <span
            class="w-6 transition-colors"
            :class="isActive(it.to) ? 'text-primary-500' : 'group-hover:text-primary-400'"
            aria-hidden="true"
          >
            <svg v-if="it.icon === 'dashboard'" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 13h8V3H3v10Zm10 8h8V11h-8v10ZM3 21h8v-6H3v6Zm10-10h8V3h-8v8Z" stroke-linejoin="round" />
            </svg>
            <svg v-else-if="it.icon === 'chat'" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H7l-4 3 1.2-4.8A8.5 8.5 0 1 1 21 11.5Z" stroke-linejoin="round" />
            </svg>
            <svg v-else-if="it.icon === 'contato'" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <svg v-else-if="it.icon === 'canais'" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 6h16M4 12h16M4 18h16" stroke-linecap="round" />
            </svg>
            <svg v-else class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              <circle cx="12" cy="12" r="4" />
            </svg>
          </span>
          <span class="font-medium">{{ it.label }}</span>
        </NuxtLink>
      </nav>

      <!-- Footer -->
      <div class="border-t border-gray-800 p-4">
        <div class="flex items-center space-x-3 rounded-xl border border-gray-700/50 bg-gray-800/50 px-4 py-3">
          <div class="h-10 w-10 rounded-full border-2 border-gray-700 bg-gray-700/60" aria-hidden="true" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold text-white">Conta</p>
            <p class="flex items-center gap-2 text-xs text-primary-400">
              <span class="h-2 w-2 animate-pulse rounded-full bg-primary-500" />
              Online
            </p>
          </div>
          <NuxtLink
            to="/"
            class="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
            aria-label="Voltar"
          >
            <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10 17l-5-5 5-5" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M5 12h14" stroke-linecap="round" />
            </svg>
          </NuxtLink>
        </div>
      </div>
    </aside>

    <main class="min-w-0 flex-1 overflow-y-auto bg-background transition-colors dark:bg-dark-background">
      <slot />
    </main>
  </div>
</template>

