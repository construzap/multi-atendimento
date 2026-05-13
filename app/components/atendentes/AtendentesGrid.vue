<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import type { AtendenteListaItem } from '#shared/types/atendentes'
import ItemCardAtendente from '~/components/atendentes/ItemCardAtendente.vue'
import CriarAtendente from '~/components/atendentes/CriarAtendente.vue'
import { useAtendentesStore } from '~/stores/atendentes'

const props = defineProps<{
  workspaceId: number
}>()

const pesquisa = ref('')
const modalAberto = ref(false)
const authUserId = ref<string | null>(null)

const atendentesStore = useAtendentesStore()
const { items, listPending, listError, souDonoWorkspace } = storeToRefs(atendentesStore)

onMounted(async () => {
  const supabase = useSupabaseClient()
  const { data } = await supabase.auth.getUser()
  authUserId.value = data.user?.id ?? null
})

watch(
  () => props.workspaceId,
  (id) => {
    pesquisa.value = ''
    if (Number.isFinite(id) && id >= 1) {
      void atendentesStore.fetchList(id)
    } else {
      atendentesStore.reset()
    }
  },
  { immediate: true },
)

function recarregar() {
  if (Number.isFinite(props.workspaceId) && props.workspaceId >= 1) {
    void atendentesStore.fetchList(props.workspaceId)
  }
}

function displayNome(a: AtendenteListaItem): string {
  return (a.nome ?? '').trim() || 'Sem nome'
}

function initials(nome: string) {
  const parts = nome.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase().slice(0, 2)
}

function gradientFromKey(key: string): string {
  const g = [
    'bg-gradient-to-br from-info to-tertiary shadow-[0_10px_30px_rgba(0,99,154,0.25)]',
    'bg-gradient-to-br from-tertiary to-tertiary-muted shadow-[0_10px_30px_rgba(0,136,212,0.25)]',
    'bg-gradient-to-br from-warning to-secondary-accent shadow-[0_10px_30px_rgba(230,81,0,0.25)]',
    'bg-gradient-to-br from-success to-success shadow-[0_10px_30px_rgba(46,125,50,0.22)]',
    'bg-gradient-to-br from-primary-500 to-primary-700 shadow-[0_10px_30px_rgba(26,123,45,0.25)]', //aquifoimodificadocor
    'bg-gradient-to-br from-danger to-error shadow-[0_10px_30px_rgba(186,26,26,0.20)]',
  ] as const
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0
  return g[Math.abs(h) % g.length]!
}

function rowKey(a: AtendenteListaItem): string {
  return String(a.id)
}

function podeExcluirCard(a: AtendenteListaItem): boolean {
  if (!souDonoWorkspace.value || !authUserId.value || !a.atendente_user_id) return false
  return a.atendente_user_id !== authUserId.value
}

const itensFiltrados = computed(() => {
  const q = pesquisa.value.trim().toLowerCase()
  const list = items.value
  if (!q) return list
  return list.filter((a) => {
    const nome = (a.nome ?? '').toLowerCase()
    const mail = (a.email ?? '').toLowerCase()
    const idStr = String(a.id)
    return nome.includes(q) || mail.includes(q) || idStr.includes(q)
  })
})
</script>

<template>
  <div>
    <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div class="relative w-full sm:max-w-md">
        <div
          class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant dark:text-dark-on-surface-variant"
        >
          <svg class="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" stroke-linecap="round" />
          </svg>
        </div>
        <input
          v-model="pesquisa"
          type="search"
          name="pesquisa-atendentes"
          placeholder="Buscar por nome, e-mail ou ID…"
          autocomplete="off"
          class="w-full rounded-xl border border-outline/40 bg-surface-container-high py-2.5 pl-10 pr-4 text-sm text-on-surface placeholder:text-on-surface-variant/80 shadow-sm transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 dark:border-dark-outline/40 dark:bg-dark-surface-container-high dark:text-dark-on-surface dark:placeholder:text-dark-on-surface-variant/70"
        />
      </div>
      <button
        type="button"
        class="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-outline/40 bg-surface-container-high px-4 py-2.5 text-sm font-medium text-on-surface shadow-sm transition-colors hover:bg-surface-container-highest dark:border-dark-outline/40 dark:bg-dark-surface-container-high dark:text-dark-on-surface dark:hover:bg-dark-surface-container-highest"
        :disabled="listPending"
        aria-label="Atualizar lista"
        @click="recarregar"
      >
        <svg
          class="h-4 w-4 shrink-0"
          :class="{ 'animate-spin': listPending }"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        >
          <path d="M21 12a9 9 0 1 1-3-6.7" stroke-linecap="round" />
          <path d="M21 3v7h-7" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        Atualizar
      </button>
    </div>

    <p
      v-if="listError"
      class="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100"
      role="alert"
    >
      {{ listError }}
    </p>

    <section class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <button
        type="button"
        class="group flex h-64 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-outline/60 bg-surface-container-lowest transition-all duration-300 hover:border-primary-500 hover:bg-primary-100/30 dark:border-dark-outline/60 dark:bg-dark-surface-container-low dark:hover:border-dark-primary dark:hover:bg-dark-primary-container/10"
        @click="modalAberto = true"
      >
        <span
          class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant transition-all duration-300 group-hover:scale-110 group-hover:bg-primary-100 group-hover:text-primary-600 dark:bg-dark-surface-container-high dark:text-dark-on-surface-variant dark:group-hover:bg-dark-primary-container/30 dark:group-hover:text-dark-primary"
          aria-hidden="true"
        >
          <svg class="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke-linecap="round" />
          </svg>
        </span>
        <h3
          class="font-headline text-lg font-semibold text-on-surface-variant transition-colors group-hover:text-primary-700 dark:text-dark-on-surface-variant dark:group-hover:text-dark-primary"
        >
          Adicionar atendente
        </h3>
        <p
          class="mt-1 max-w-[22ch] text-center font-body text-sm text-on-surface-variant/80 dark:text-dark-on-surface-variant/80"
        >
          Convide alguém da equipe para este workspace
        </p>
      </button>

      <div
        v-if="listPending"
        class="col-span-full rounded-2xl border border-outline/40 bg-surface-container-lowest p-6 text-sm text-on-surface-variant dark:border-dark-outline/40 dark:bg-dark-surface-container-low dark:text-dark-on-surface-variant"
      >
        Carregando atendentes…
      </div>

      <div
        v-else-if="itensFiltrados.length === 0"
        class="col-span-full rounded-2xl border border-outline/40 bg-surface-container-lowest p-6 text-sm text-on-surface-variant dark:border-dark-outline/40 dark:bg-dark-surface-container-low dark:text-dark-on-surface-variant"
      >
        <template v-if="pesquisa.trim()">
          Nenhum resultado para “{{ pesquisa.trim() }}”.
        </template>
        <template v-else>
          Nenhum atendente neste workspace ainda.
        </template>
      </div>

      <ItemCardAtendente
        v-for="a in itensFiltrados"
        v-else
        :key="rowKey(a)"
        :registro-id="a.id"
        :atendente-user-id="a.atendente_user_id"
        :workspace-id="workspaceId"
        :pode-excluir="podeExcluirCard(a)"
        :nome="displayNome(a)"
        :email="a.email"
        :avatar-text="initials(displayNome(a))"
        :avatar-gradient-class="gradientFromKey(rowKey(a))"
      />
    </section>

    <CriarAtendente v-model:open="modalAberto" :workspace-id="workspaceId" />
  </div>
</template>
