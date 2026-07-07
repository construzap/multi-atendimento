<script setup lang="ts">
import { computed, watch } from 'vue'
import { NuxtLink } from '#components'
import AdminAcessoNegado from '~/components/admin/AdminAcessoNegado.vue'
import AdminEmpresaSeletor from '~/components/admin/AdminEmpresaSeletor.vue'
import SeletorCanaisIa from '~/components/admin/ia/SeletorCanaisIa.vue'
import type { AdminEmpresaRow } from '#shared/types/admin'
import type { AdminVerificarResponse } from '#shared/types/profile'

const adminStore = useAdminStore()
const route = useRoute()
const mobileSidebarOpen = ref(false)

const isPaginaIa = computed(() => route.path.startsWith('/admin/ia'))

const {
  data: verificarData,
  pending: verificarPending,
  error: verificarError,
} = await useFetch<AdminVerificarResponse>('/api/admin/verificar', {
  server: false,
})

const isAdmin = computed(() => verificarData.value?.isAdmin === true)

watch(
  isAdmin,
  (admin) => {
    if (admin) {
      adminStore.fetchWorkspacesSeNecessario().catch(() => {})
    }
  },
  { immediate: true },
)

watch(
  () => adminStore.selectedWorkspaceId,
  (id) => {
    if (id) {
      adminStore.fetchPromptsSeNecessario(id).catch(() => {})
      if (isPaginaIa.value) {
        useAdminIaStore().fetchCanaisSeNecessario(id).catch(() => {})
      }
    }
  },
  { immediate: true },
)

watch(isPaginaIa, (paginaIa) => {
  const id = adminStore.selectedWorkspaceId
  if (paginaIa && id) {
    useAdminIaStore().fetchCanaisSeNecessario(id).catch(() => {})
  }
})

const companies = computed<AdminEmpresaRow[]>(() => adminStore.workspaceSeletorRows)

const verificarErroTexto = computed(() => {
  const e = verificarError.value as Error & { data?: { statusMessage?: string; message?: string } } | null
  if (!e) return null
  return e.data?.statusMessage ?? e.data?.message ?? e.message ?? 'Não foi possível verificar o acesso.'
})

const carregandoInicial = computed(
  () =>
    verificarPending.value ||
    (isAdmin.value && adminStore.workspacesPending && !adminStore.workspacesLoaded),
)

function onSelectCompany(company: AdminEmpresaRow) {
  adminStore.setSelectedWorkspaceId(company.id)
  mobileSidebarOpen.value = false
}

function closeMobileSidebar() {
  mobileSidebarOpen.value = false
}
</script>

<template>
  <AdminAcessoNegado v-if="!verificarPending && !verificarErroTexto && !isAdmin" />

  <div
    v-else-if="verificarPending || carregandoInicial"
    class="flex h-screen items-center justify-center bg-background text-sm text-on-surface-variant dark:bg-dark-background dark:text-dark-on-surface-variant"
  >
    Verificando permissões...
  </div>

  <div
    v-else-if="verificarErroTexto"
    class="flex h-screen items-center justify-center bg-background px-4 dark:bg-dark-background"
  >
    <p class="text-sm text-danger dark:text-dark-danger">
      {{ verificarErroTexto }}
    </p>
  </div>

  <div
    v-else-if="adminStore.workspacesError"
    class="flex h-screen items-center justify-center bg-background px-4 dark:bg-dark-background"
  >
    <p class="text-sm text-danger dark:text-dark-danger">
      {{ adminStore.workspacesError }}
    </p>
  </div>

  <div
    v-else
    class="flex h-screen w-full overflow-hidden bg-background text-on-surface transition-colors dark:bg-dark-background dark:text-dark-on-surface"
  >
    <!-- Mobile: abrir seletor -->
    <button
      type="button"
      class="fixed left-3 top-3 z-50 inline-flex items-center justify-center rounded-xl border border-outline/40 bg-surface-container-lowest/90 p-2 text-on-surface shadow-sm backdrop-blur transition-colors hover:bg-surface-container-high dark:border-dark-outline/40 dark:bg-dark-surface-container-low/90 dark:text-dark-on-surface md:hidden"
      aria-label="Abrir seletor de workspaces"
      @click="mobileSidebarOpen = true"
    >
      <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path d="M3 21h18M5 21V7l7-4 7 4v14" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>

    <!-- Mobile drawer -->
    <div v-if="mobileSidebarOpen" class="fixed inset-0 z-50 md:hidden">
      <button
        type="button"
        class="absolute inset-0 h-full w-full bg-black/50"
        aria-label="Fechar seletor"
        @click="closeMobileSidebar"
      />
      <aside
        class="absolute left-0 top-0 flex h-full w-[18.5rem] flex-col overflow-hidden border-r border-outline/40 bg-surface-container-lowest shadow-2xl dark:border-dark-outline/40 dark:bg-dark-surface-container-low"
        aria-label="Seletor de workspaces"
      >
        <div class="flex items-center justify-between gap-2 border-b border-outline/40 px-4 py-3 dark:border-dark-outline/40">
          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
              Admin
            </p>
            <p class="text-sm font-semibold text-on-surface dark:text-dark-on-surface">
              Selecionar workspace
            </p>
          </div>
          <button
            type="button"
            class="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high dark:text-dark-on-surface-variant dark:hover:bg-dark-surface-container-high"
            aria-label="Fechar"
            @click="closeMobileSidebar"
          >
            <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 6l12 12M18 6L6 18" stroke-linecap="round" />
            </svg>
          </button>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto">
          <AdminEmpresaSeletor
            :companies="companies"
            :selected-company-id="adminStore.selectedWorkspaceId"
            :loading="adminStore.workspacesPending && !adminStore.workspacesLoaded"
            @select="onSelectCompany"
          />
          <div
            v-if="isPaginaIa"
            class="border-t border-outline/40 dark:border-dark-outline/40"
          >
            <SeletorCanaisIa compact />
          </div>
        </div>
      </aside>
    </div>

    <!-- Desktop sidebar -->
    <aside
      class="hidden w-72 shrink-0 flex-col overflow-hidden border-r border-outline/40 bg-surface-container-lowest dark:border-dark-outline/40 dark:bg-dark-surface-container-low md:flex"
      aria-label="Seletor de workspaces"
    >
      <div class="shrink-0 border-b border-outline/40 px-4 py-4 dark:border-dark-outline/40">
        <NuxtLink
          to="/admin"
          class="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-on-surface-variant transition-colors hover:text-primary-600 dark:text-dark-on-surface-variant dark:hover:text-dark-primary"
        >
          <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          Voltar ao admin
        </NuxtLink>
        <p class="text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
          Painel administrativo
        </p>
        <h2 class="mt-0.5 font-headline text-base font-bold text-on-surface dark:text-dark-on-surface">
          Workspaces
        </h2>
      </div>

      <div class="min-h-0 flex-1">
        <AdminEmpresaSeletor
          :companies="companies"
          :selected-company-id="adminStore.selectedWorkspaceId"
          :loading="adminStore.workspacesPending && !adminStore.workspacesLoaded"
          @select="onSelectCompany"
        />
      </div>
    </aside>

    <!-- Desktop: seletor de canais I.A (somente na página /admin/ia) -->
    <aside
      v-if="isPaginaIa"
      class="hidden w-72 shrink-0 flex-col overflow-hidden border-r border-outline/40 bg-surface-container-lowest dark:border-dark-outline/40 dark:bg-dark-surface-container-low md:flex"
      aria-label="Seletor de canais com I.A"
    >
      <SeletorCanaisIa />
    </aside>

    <main class="min-w-0 flex-1 overflow-y-auto bg-background transition-colors dark:bg-dark-background">
      <div
        v-if="isPaginaIa"
        class="border-b border-outline/40 md:hidden dark:border-dark-outline/40"
      >
        <SeletorCanaisIa compact />
      </div>
      <slot />
    </main>
  </div>
</template>
