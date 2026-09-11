<script setup lang="ts">
import { NuxtLink } from '#components'
import AdminAcessoNegado from '~/components/admin/pagina_inicial/AdminAcessoNegado.vue'
import SeletorProfiles from '~/components/admin/gerenciar_assinaturas/SeletorProfiles.vue'
import { mensagemErroFetch } from '~/stores/canais'
import { useAdminGerenciarAssinaturasStore } from '~/stores/adminGerenciarAssinaturas'

const mobileSidebarOpen = ref(false)
const assinaturasStore = useAdminGerenciarAssinaturasStore()

const { pending: verificarPending, isAdmin, erroTexto: verificarErroTexto } = useAdminGate()

const carregandoInicial = computed(
  () =>
    verificarPending.value ||
    (isAdmin.value && assinaturasStore.pending && !assinaturasStore.loaded),
)

async function carregarPerfis() {
  try {
    await assinaturasStore.fetchLista()
  } catch (err) {
    // Erro já fica na store; evita unhandled rejection no layout
    console.error(mensagemErroFetch(err, 'Falha ao carregar perfis'))
  }
}

watch(
  isAdmin,
  (ok) => {
    if (ok) {
      carregarPerfis().catch(() => {})
    } else {
      assinaturasStore.clear()
    }
  },
  { immediate: true },
)

function onSelectProfile() {
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
    v-else
    class="flex h-screen w-full overflow-hidden bg-background text-on-surface transition-colors dark:bg-dark-background dark:text-dark-on-surface"
  >
    <button
      type="button"
      class="fixed left-3 top-3 z-50 inline-flex items-center justify-center rounded-xl border border-outline/40 bg-surface-container-lowest/90 p-2 text-on-surface shadow-sm backdrop-blur transition-colors hover:bg-surface-container-high dark:border-dark-outline/40 dark:bg-dark-surface-container-low/90 dark:text-dark-on-surface md:hidden"
      aria-label="Abrir seletor de perfis"
      @click="mobileSidebarOpen = true"
    >
      <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke-linecap="round" stroke-linejoin="round" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>

    <div v-if="mobileSidebarOpen" class="fixed inset-0 z-50 md:hidden">
      <button
        type="button"
        class="absolute inset-0 h-full w-full bg-black/50"
        aria-label="Fechar seletor"
        @click="closeMobileSidebar"
      />
      <aside
        class="absolute left-0 top-0 flex h-full w-[18.5rem] flex-col overflow-hidden border-r border-outline/40 bg-surface-container-lowest shadow-2xl dark:border-dark-outline/40 dark:bg-dark-surface-container-low"
        aria-label="Seletor de perfis"
      >
        <div class="flex items-center justify-between gap-2 border-b border-outline/40 px-4 py-3 dark:border-dark-outline/40">
          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
              Admin
            </p>
            <p class="text-sm font-semibold text-on-surface dark:text-dark-on-surface">
              Selecionar perfil
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
        <div class="min-h-0 flex-1 overflow-hidden">
          <SeletorProfiles @select="onSelectProfile" />
        </div>
      </aside>
    </div>

    <aside
      class="hidden w-80 shrink-0 flex-col overflow-hidden border-r border-outline/40 bg-surface-container-lowest dark:border-dark-outline/40 dark:bg-dark-surface-container-low md:flex"
      aria-label="Seletor de perfis"
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
          Perfis
        </h2>
      </div>

      <div class="min-h-0 flex-1 overflow-hidden">
        <SeletorProfiles @select="onSelectProfile" />
      </div>
    </aside>

    <main class="min-w-0 flex-1 overflow-y-auto bg-background transition-colors dark:bg-dark-background">
      <slot />
    </main>
  </div>
</template>
