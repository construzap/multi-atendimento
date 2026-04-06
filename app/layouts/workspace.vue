<script setup lang="ts">
import { computed, ref, watch } from 'vue'

/** Recolhida por padrão; expande enquanto o ponteiro estiver sobre a sidebar. */
const sidebarHovered = ref(false)

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
  const path = route.path
  if (to.endsWith('/chat')) {
    return path === to || path.startsWith(`${to}/`)
  }
  return path === to
}

const sidebarCollapsed = computed(() => !sidebarHovered.value)
</script>

<template>
  <div class="flex h-screen w-full overflow-hidden bg-background text-on-surface transition-colors dark:bg-dark-background dark:text-dark-on-surface">
    <aside
      class="sidebar-shell flex shrink-0 flex-col overflow-hidden border-r border-gray-800/80 bg-gray-900 text-gray-100"
      :class="sidebarCollapsed ? 'w-[4.25rem]' : 'w-64'"
      :aria-expanded="sidebarHovered"
      aria-label="Menu do workspace"
      @mouseenter="sidebarHovered = true"
      @mouseleave="sidebarHovered = false"
    >
      <!-- Header -->
      <div class="sidebar-section border-b border-gray-800" :class="sidebarCollapsed ? 'px-2 py-4' : 'p-6'">
        <div
          class="flex items-center"
          :class="sidebarCollapsed ? 'flex-col gap-3' : 'space-x-3'"
        >
          <div
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 shadow-lg shadow-primary-500/20"
            aria-hidden="true"
          >
            <svg class="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path
                d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H7l-4 3 1.2-4.8A8.5 8.5 0 1 1 21 11.5Z"
                stroke-linejoin="round"
              />
            </svg>
          </div>
          <div v-show="!sidebarCollapsed" class="min-w-0 flex-1">
            <h1 class="text-lg font-bold tracking-tight text-white">Multi Chat</h1>
            <p class="text-xs font-medium text-gray-400">Sistema de Atendimento</p>
          </div>
        </div>
      </div>

      <!-- Navigation -->
      <nav
        class="sidebar-nav flex-1 space-y-1 overflow-y-auto overflow-x-hidden p-2"
        :class="sidebarCollapsed ? 'px-1.5' : 'p-4'"
      >
        <NuxtLink
          v-for="it in items"
          :key="it.to"
          :to="it.to"
          class="sidebar-link group flex items-center rounded-xl py-3"
          :class="[
            sidebarCollapsed ? 'justify-center px-2' : 'space-x-3 px-4',
            isActive(it.to)
              ? 'bg-gray-800 text-primary-500 shadow-md shadow-gray-900/50'
              : 'text-gray-300 hover:bg-gray-800 hover:text-white'
          ]"
          :title="sidebarCollapsed ? it.label : undefined"
        >
          <span
            class="sidebar-icon-slot flex shrink-0 justify-center transition-colors"
            :class="[
              sidebarCollapsed ? 'w-10' : 'w-6',
              isActive(it.to) ? 'text-primary-500' : 'group-hover:text-primary-400'
            ]"
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
          <span v-show="!sidebarCollapsed" class="font-medium">{{ it.label }}</span>
          <span v-if="sidebarCollapsed" class="sr-only">{{ it.label }}</span>
        </NuxtLink>
      </nav>

      <!-- Footer -->
      <div class="sidebar-footer border-t border-gray-800" :class="sidebarCollapsed ? 'p-2' : 'p-4'">
        <div
          class="sidebar-footer-inner flex rounded-xl border border-gray-700/50 bg-gray-800/50 py-3"
          :class="
            sidebarCollapsed
              ? 'flex-col items-center gap-2 px-1'
              : 'items-center space-x-3 px-4'
          "
        >
          <div
            class="sidebar-avatar shrink-0 rounded-full border-2 border-gray-700 bg-gray-700/60"
            :class="sidebarCollapsed ? 'h-9 w-9' : 'h-10 w-10'"
            aria-hidden="true"
          />
          <div v-show="!sidebarCollapsed" class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold text-white">Conta</p>
            <p class="flex items-center gap-2 text-xs text-primary-400">
              <span class="h-2 w-2 animate-pulse rounded-full bg-primary-500" />
              Online
            </p>
          </div>
          <NuxtLink
            to="/"
            class="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
            :title="sidebarCollapsed ? 'Voltar ao início' : undefined"
            aria-label="Voltar ao início"
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

<style scoped>
/* Animação da sidebar: curva com desaceleração no fim + mesma duração nos paddings internos. */
.sidebar-shell {
  transition: width 0.48s cubic-bezier(0.22, 1, 0.36, 1);
}

.sidebar-section,
.sidebar-nav,
.sidebar-footer {
  transition: padding 0.48s cubic-bezier(0.22, 1, 0.36, 1);
}

.sidebar-link {
  transition:
    padding 0.48s cubic-bezier(0.22, 1, 0.36, 1),
    color 0.2s ease,
    background-color 0.2s ease,
    box-shadow 0.2s ease;
}

.sidebar-icon-slot {
  transition:
    width 0.48s cubic-bezier(0.22, 1, 0.36, 1),
    color 0.2s ease;
}

.sidebar-footer-inner {
  transition:
    padding 0.48s cubic-bezier(0.22, 1, 0.36, 1),
    gap 0.48s cubic-bezier(0.22, 1, 0.36, 1);
}

.sidebar-avatar {
  transition:
    width 0.48s cubic-bezier(0.22, 1, 0.36, 1),
    height 0.48s cubic-bezier(0.22, 1, 0.36, 1);
}

@media (prefers-reduced-motion: reduce) {
  .sidebar-shell,
  .sidebar-section,
  .sidebar-nav,
  .sidebar-footer,
  .sidebar-link,
  .sidebar-icon-slot,
  .sidebar-footer-inner,
  .sidebar-avatar {
    transition-duration: 0.01ms !important;
  }
}
</style>

