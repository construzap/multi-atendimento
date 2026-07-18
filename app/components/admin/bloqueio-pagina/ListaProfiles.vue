<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import ItemProfile from '~/components/admin/bloqueio-pagina/ItemProfile.vue'
import { listarPaginasWorkspaceBloqueio } from '~/components/admin/bloqueio-pagina/paginasWorkspace'
import { useAdminBloqueioPaginaStore } from '~/stores/adminBloqueioPagina'
import { mensagemErroFetch } from '~/stores/canais'

const adminStore = useAdminStore()
const bloqueioStore = useAdminBloqueioPaginaStore()

const { selectedWorkspaceId, workspaceSelecionado } = storeToRefs(adminStore)
const { profiles, pending, loaded, error: errorMsg } = storeToRefs(bloqueioStore)

const paginas = computed(() => listarPaginasWorkspaceBloqueio())

async function carregar(workspaceId: string, { force = false } = {}) {
  try {
    await bloqueioStore.fetchWorkspaceData(workspaceId, { force })
  } catch (err) {
    toast.error(mensagemErroFetch(err, 'Não foi possível carregar bloqueio de páginas.'))
  }
}

watch(
  selectedWorkspaceId,
  (id) => {
    if (!id) {
      bloqueioStore.clear()
      return
    }
    carregar(id).catch(() => {})
  },
  { immediate: true },
)
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col gap-4">
    <div
      v-if="!selectedWorkspaceId"
      class="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-outline/40 bg-surface-container-lowest px-6 py-16 text-center dark:border-dark-outline/40 dark:bg-dark-surface-container-low"
    >
      <div
        class="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-700 dark:text-amber-400"
        aria-hidden="true"
      >
        <svg class="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="5" y="11" width="14" height="10" rx="2" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </div>
      <p class="text-sm font-semibold text-on-surface dark:text-dark-on-surface">
        Selecione um workspace
      </p>
      <p class="mt-1 max-w-sm text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
        Escolha um workspace na barra lateral para gerenciar o bloqueio de páginas.
      </p>
    </div>

    <template v-else>
      <div class="flex shrink-0 items-end justify-between gap-3">
        <div>
          <h2 class="font-headline text-sm font-bold text-on-surface dark:text-dark-on-surface">
            Usuários vinculados
            <template v-if="loaded && !pending">({{ profiles.length }})</template>
          </h2>
          <p class="mt-0.5 text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
            {{ workspaceSelecionado?.nome || '—' }}
          </p>
        </div>
        <button
          type="button"
          class="rounded-lg border border-outline/40 px-2.5 py-1.5 text-xs font-semibold text-on-surface-variant transition-colors hover:border-primary-300 hover:text-primary-600 disabled:opacity-50 dark:border-dark-outline/40 dark:text-dark-on-surface-variant"
          :disabled="pending"
          @click="carregar(selectedWorkspaceId, { force: true })"
        >
          {{ pending ? 'Carregando...' : 'Atualizar' }}
        </button>
      </div>

      <div
        v-if="pending && !loaded"
        class="flex items-center justify-center gap-2 rounded-2xl border border-outline/40 bg-surface-container-lowest px-6 py-16 text-sm text-on-surface-variant dark:border-dark-outline/40 dark:bg-dark-surface-container-low dark:text-dark-on-surface-variant"
      >
        <svg class="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Carregando profiles e permissões...
      </div>

      <div
        v-else-if="errorMsg"
        class="rounded-2xl border border-danger/30 bg-danger-container/20 px-6 py-10 text-center text-sm text-danger dark:border-danger/40 dark:text-dark-danger"
      >
        {{ errorMsg }}
      </div>

      <div
        v-else-if="!profiles.length"
        class="rounded-2xl border border-dashed border-outline/40 bg-surface-container-lowest px-6 py-16 text-center text-sm text-on-surface-variant dark:border-dark-outline/40 dark:bg-dark-surface-container-low dark:text-dark-on-surface-variant"
      >
        Nenhum profile encontrado para este workspace.
      </div>

      <div
        v-else
        class="min-h-0 flex-1 overflow-auto rounded-2xl border border-outline/40 bg-surface-container-lowest shadow-sm dark:border-dark-outline/40 dark:bg-dark-surface-container-low"
      >
        <table class="min-w-full border-collapse text-left">
          <thead>
            <tr class="border-b border-outline/30 bg-surface-container-high/60 dark:border-dark-outline/30 dark:bg-dark-surface-container-high/40">
              <th
                class="sticky left-0 z-20 min-w-[14rem] bg-surface-container-high/95 px-4 py-3 text-xs font-semibold text-on-surface-variant backdrop-blur dark:bg-dark-surface-container-high/95 dark:text-dark-on-surface-variant"
              >
                Usuário
              </th>
              <th
                class="whitespace-nowrap px-3 py-3 text-center text-xs font-semibold text-on-surface-variant dark:text-dark-on-surface-variant"
              >
                Papel
              </th>
              <th
                v-for="pagina in paginas"
                :key="pagina.slug"
                class="whitespace-nowrap px-2 py-3 text-center text-xs font-semibold text-on-surface-variant dark:text-dark-on-surface-variant"
                :title="pagina.path"
              >
                {{ pagina.label }}
              </th>
            </tr>
          </thead>
          <tbody>
            <ItemProfile
              v-for="profile in profiles"
              :key="profile.user_id"
              :profile="profile"
              :paginas="paginas"
            />
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
