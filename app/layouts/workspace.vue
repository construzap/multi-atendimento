<script setup lang="ts">
import { computed, ref } from 'vue'
import { useColorMode } from '~/composables/useColorMode'
import type { AdminVerificarResponse } from '#shared/types/profile'

/** Recolhida por padrão; expande enquanto o ponteiro estiver sobre a sidebar. */
const sidebarHovered = ref(false)
const mobileSidebarOpen = ref(false)

const { isDark, toggle: toggleTheme } = useColorMode()

const temaLabel = computed(() => (isDark.value ? 'Modo claro' : 'Modo escuro'))

type NavItem = {
  label: string
  to: string
  icon:
    | 'dashboard'
    | 'chat'
    | 'contato'
    | 'canais'
    | 'produtos'
    | 'vectorStore'
    | 'buscarProdutosIa'
    | 'atendentes'
    | 'frete'
    | 'agendamento'
    | 'logs'
    | 'configuracoes'
}

const route = useRoute()
const workspaces = useWorkspacesStore()

const { data: verificarAdmin } = await useFetch<AdminVerificarResponse>('/api/admin/verificar', {
  server: false,
})
const isAdmin = computed(() => verificarAdmin.value?.isAdmin === true)

const workspaceId = computed(() => workspaces.currentWorkspaceId ?? String(route.params.id ?? ''))
const base = computed(() => `/workspaces/${workspaceId.value}`)
const enviarIaBase = computed(() => `${base.value}/produtos/enviar-para-ia`)

const items = computed<NavItem[]>(() => {
  const nav: NavItem[] = [
    { label: 'Kanban', to: `${base.value}/kanban`, icon: 'dashboard' },
    { label: 'Chat', to: `${base.value}/chat`, icon: 'chat' },
    { label: 'Contato', to: `${base.value}/contato`, icon: 'contato' },
    { label: 'Canais', to: `${base.value}/canais`, icon: 'canais' },
    { label: 'Produtos', to: `${base.value}/produtos`, icon: 'produtos' },
    { label: 'Vector Store (IA)', to: `${enviarIaBase.value}/vector-store`, icon: 'vectorStore' },
    { label: 'Atendentes', to: `${base.value}/atendentes`, icon: 'atendentes' },
    { label: 'Frete', to: `${base.value}/frete`, icon: 'frete' },
    { label: 'Agendamento de mensagens', to: `${base.value}/agendamento-mensagens`, icon: 'agendamento' },
  ]
  if (isAdmin.value) {
    nav.push({ label: 'Logs de webhook', to: `${base.value}/logs`, icon: 'logs' })
  }
  nav.push({ label: 'Configurações', to: `${base.value}/configuracoes`, icon: 'configuracoes' })
  return nav
})

function isActive(to: string) {
  const path = route.path
  if (to.includes('/enviar-para-ia/')) {
    return path === to || path.startsWith(`${to}/`)
  }
  if (to.endsWith('/chat') || to.endsWith('/produtos')) {
    if (to.endsWith('/produtos') && path.includes('/produtos/enviar-para-ia/')) {
      return false
    }
    return path === to || path.startsWith(`${to}/`)
  }
  return path === to
}

const sidebarCollapsed = computed(() => !sidebarHovered.value)

function closeMobileSidebar() {
  mobileSidebarOpen.value = false
}
</script>

<template>
  <div class="flex h-screen w-full overflow-hidden bg-background text-on-surface transition-colors dark:bg-dark-background dark:text-dark-on-surface">
    <!-- Mobile: botão para abrir menu lateral -->
    <button
      type="button"
      class="fixed left-3 top-3 z-50 inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white/90 p-2 text-slate-700 shadow-sm backdrop-blur transition-colors hover:bg-white dark:border-slate-800 dark:bg-slate-950/80 dark:text-slate-200 md:hidden"
      aria-label="Abrir menu"
      @click="mobileSidebarOpen = true"
    >
      <span class="material-symbols-outlined text-[22px]" aria-hidden="true">menu</span>
    </button>

    <!-- Mobile: drawer lateral -->
    <div v-if="mobileSidebarOpen" class="fixed inset-0 z-50 md:hidden">
      <button
        type="button"
        class="absolute inset-0 h-full w-full bg-black/50"
        aria-label="Fechar menu"
        @click="closeMobileSidebar"
      />
      <aside
        class="sidebar-shell absolute left-0 top-0 flex h-full w-[18.5rem] flex-col overflow-hidden border-r border-gray-800/80 bg-gray-900 text-gray-100 shadow-2xl"
        aria-label="Menu do workspace"
      >
        <!-- Header -->
        <div class="sidebar-section border-b border-gray-800 p-6">
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center space-x-3">
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
              <div class="min-w-0 flex-1">
                <h1 class="text-lg font-bold tracking-tight text-white">Multi Chat</h1>
                <p class="text-xs font-medium text-gray-400">Sistema de Atendimento</p>
              </div>
            </div>

            <button
              type="button"
              class="rounded-lg p-2 text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
              aria-label="Fechar menu"
              @click="closeMobileSidebar"
            >
              <span class="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
            </button>
          </div>
        </div>

        <!-- Navigation -->
        <nav class="sidebar-nav flex-1 space-y-1 overflow-y-auto overflow-x-hidden p-4">
          <NuxtLink
            v-for="it in items"
            :key="it.to"
            :to="it.to"
            class="sidebar-link group flex items-center space-x-3 rounded-xl px-4 py-3"
            :class="isActive(it.to) ? 'bg-gray-800 text-primary-500 shadow-md shadow-gray-900/50' : 'text-gray-300 hover:bg-gray-800 hover:text-white'"
            @click="closeMobileSidebar"
          >
            <span
              class="sidebar-icon-slot flex w-6 shrink-0 justify-center transition-colors"
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
              <svg v-else-if="it.icon === 'produtos'" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" stroke-linejoin="round" />
                <path d="M3.27 6.96 12 12.01 20.73 6.96M12 22.08V12" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <svg v-else-if="it.icon === 'vectorStore'" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <ellipse cx="12" cy="5" rx="9" ry="3" />
                <path d="M3 5v6c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
                <path d="M3 11v6c0 1.66 4.03 3 9 3s9-1.34 9-3v-6" />
              </svg>
              <svg v-else-if="it.icon === 'buscarProdutosIa'" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
                <path d="M8 11h6M11 8v6" />
              </svg>
              <svg v-else-if="it.icon === 'atendentes'" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke-linecap="round" />
              </svg>
              <svg v-else-if="it.icon === 'frete'" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 18V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h1" />
                <path d="M15 18H9" />
                <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
                <circle cx="17" cy="18" r="2" />
                <circle cx="7" cy="18" r="2" />
              </svg>
              <svg v-else-if="it.icon === 'agendamento'" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
                <path d="M12 14v3M10.5 15.5h3" />
              </svg>
              <svg v-else-if="it.icon === 'logs'" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
              </svg>
              <svg v-else-if="it.icon === 'configuracoes'" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                <circle cx="12" cy="12" r="4" />
              </svg>
            </span>
            <span class="font-medium">{{ it.label }}</span>
          </NuxtLink>
        </nav>

        <!-- Footer -->
        <div class="sidebar-footer border-t border-gray-800 p-4">
          <div class="sidebar-footer-inner flex items-center space-x-3 rounded-xl border border-gray-700/50 bg-gray-800/50 px-4 py-3">
            <div class="sidebar-avatar h-10 w-10 shrink-0 rounded-full border-2 border-gray-700 bg-gray-700/60" aria-hidden="true" />
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-semibold text-white">Conta</p>
              <p class="flex items-center gap-2 text-xs text-primary-400">
                <span class="h-2 w-2 animate-pulse rounded-full bg-primary-500" />
                Online
              </p>
            </div>
            <button
              type="button"
              class="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
              :aria-label="temaLabel"
              @click="toggleTheme"
            >
              <span class="material-symbols-outlined text-[20px]" aria-hidden="true">
                {{ isDark ? 'light_mode' : 'dark_mode' }}
              </span>
            </button>
            <NuxtLink
              to="/"
              class="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
              aria-label="Alterar workspace"
              @click="closeMobileSidebar"
            >
              <span class="material-symbols-outlined text-[20px]" aria-hidden="true">arrow_back</span>
            </NuxtLink>
          </div>
        </div>
      </aside>
    </div>

    <!-- Desktop sidebar -->
    <aside
      class="hidden md:flex sidebar-shell shrink-0 flex-col overflow-hidden border-r border-gray-800/80 bg-gray-900 text-gray-100"
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
            <svg v-else-if="it.icon === 'produtos'" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" stroke-linejoin="round" />
              <path d="M3.27 6.96 12 12.01 20.73 6.96M12 22.08V12" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <svg v-else-if="it.icon === 'vectorStore'" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <ellipse cx="12" cy="5" rx="9" ry="3" />
              <path d="M3 5v6c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
              <path d="M3 11v6c0 1.66 4.03 3 9 3s9-1.34 9-3v-6" />
            </svg>
            <svg v-else-if="it.icon === 'buscarProdutosIa'" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
              <path d="M8 11h6M11 8v6" />
            </svg>
            <svg v-else-if="it.icon === 'atendentes'" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke-linecap="round" />
            </svg>
            <svg v-else-if="it.icon === 'frete'" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 18V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h1" />
              <path d="M15 18H9" />
              <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
              <circle cx="17" cy="18" r="2" />
              <circle cx="7" cy="18" r="2" />
            </svg>
            <svg v-else-if="it.icon === 'agendamento'" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
              <path d="M12 14v3M10.5 15.5h3" />
            </svg>
            <svg v-else-if="it.icon === 'logs'" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
            </svg>
            <svg v-else-if="it.icon === 'configuracoes'" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
          <div
            class="flex shrink-0 items-center"
            :class="sidebarCollapsed ? 'flex-col gap-1' : 'gap-0.5'"
          >
            <button
              type="button"
              class="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
              :title="temaLabel"
              :aria-label="temaLabel"
              @click="toggleTheme"
            >
              <span class="material-symbols-outlined text-[20px]" aria-hidden="true">
                {{ isDark ? 'light_mode' : 'dark_mode' }}
              </span>
            </button>
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
      </div>
    </aside>

    <main class="relative min-w-0 flex-1 overflow-y-auto bg-background transition-colors dark:bg-dark-background">
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

