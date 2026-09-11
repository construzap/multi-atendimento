<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useAdminGerenciarAssinaturasStore } from '~/stores/adminGerenciarAssinaturas'

const emit = defineEmits<{
  select: [userId: string]
}>()

const store = useAdminGerenciarAssinaturasStore()
const { perfis, selectedUserId, pending, loaded, error } = storeToRefs(store)

const busca = ref('')

const filtrados = computed(() => {
  const q = busca.value.trim().toLowerCase()
  if (!q) return perfis.value
  return perfis.value.filter((p) => {
    const nome = (p.full_name ?? '').toLowerCase()
    const email = (p.email ?? '').toLowerCase()
    return nome.includes(q) || email.includes(q)
  })
})

function nomeExibicao(fullName: string | null, email: string | null, userId: string) {
  return fullName?.trim() || email?.trim() || userId
}

function classeStatusAssinatura(status: string) {
  const s = status.toLowerCase()
  if (s === 'ativo' || s === 'trial') {
    return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
  }
  if (s === 'vencida') {
    return 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
  }
  if (s === 'pendente' || s === 'cancelado') {
    return 'bg-danger/10 text-danger dark:text-dark-danger'
  }
  return 'bg-surface-container-high text-on-surface-variant dark:bg-dark-surface-container-high dark:text-dark-on-surface-variant'
}

function classeStatusTokens(status: string) {
  const s = status.toLowerCase()
  if (s === 'dentro do limite') {
    return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
  }
  if (s === 'limite atingido') {
    return 'bg-danger/10 text-danger dark:text-dark-danger'
  }
  return 'bg-surface-container-high text-on-surface-variant dark:bg-dark-surface-container-high dark:text-dark-on-surface-variant'
}

function onSelect(userId: string) {
  store.selecionarPerfil(userId).catch(() => {})
  emit('select', userId)
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div class="shrink-0 border-b border-outline/40 px-3 py-3 dark:border-dark-outline/40">
      <label class="sr-only" for="busca-perfis-admin">Buscar perfil</label>
      <input
        id="busca-perfis-admin"
        v-model="busca"
        type="search"
        placeholder="Buscar por nome ou e-mail..."
        class="h-10 w-full rounded-xl border border-outline/40 bg-surface-container-high px-3 text-sm text-on-surface placeholder:text-on-surface-variant/70 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 dark:border-dark-outline/40 dark:bg-dark-surface-container-high dark:text-dark-on-surface dark:placeholder:text-dark-on-surface-variant/70 dark:focus:ring-primary-900/40"
      />
    </div>

    <div
      v-if="pending && !loaded"
      class="flex flex-1 items-center justify-center px-4 py-8 text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
    >
      Carregando perfis...
    </div>

    <div
      v-else-if="error && !perfis.length"
      class="flex flex-1 items-center justify-center px-4 py-8 text-center text-sm text-danger dark:text-dark-danger"
    >
      {{ error }}
    </div>

    <div
      v-else-if="loaded && !filtrados.length"
      class="flex flex-1 items-center justify-center px-4 py-8 text-center text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
    >
      Nenhum perfil encontrado.
    </div>

    <ul
      v-else
      class="min-h-0 flex-1 list-none space-y-1 overflow-y-auto p-2"
      role="listbox"
      aria-label="Lista de perfis"
    >
      <li v-for="perfil in filtrados" :key="perfil.user_id">
        <button
          type="button"
          role="option"
          class="w-full rounded-xl px-3 py-2.5 text-left transition-colors"
          :class="
            selectedUserId === perfil.user_id
              ? 'bg-primary-500/10 ring-1 ring-primary-500/40'
              : 'hover:bg-surface-container-high dark:hover:bg-dark-surface-container-high'
          "
          :aria-selected="selectedUserId === perfil.user_id"
          @click="onSelect(perfil.user_id)"
        >
          <p class="truncate text-sm font-semibold text-on-surface dark:text-dark-on-surface">
            {{ nomeExibicao(perfil.full_name, perfil.email, perfil.user_id) }}
          </p>
          <div class="mt-1.5 flex flex-wrap gap-1.5">
            <span
              class="inline-flex max-w-full truncate rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
              :class="classeStatusAssinatura(perfil.status_assinatura)"
            >
              {{ perfil.status_assinatura || '—' }}
            </span>
            <span
              class="inline-flex max-w-full truncate rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
              :class="classeStatusTokens(perfil.status_limite_tokens)"
            >
              {{ perfil.status_limite_tokens || '—' }}
            </span>
          </div>
        </button>
      </li>
    </ul>
  </div>
</template>
