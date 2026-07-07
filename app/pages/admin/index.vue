<script setup lang="ts">
import { computed } from 'vue'
import AdminAcessoNegado from '~/components/admin/AdminAcessoNegado.vue'
import SeletorPagina from '~/components/admin/SeletorPagina.vue'
import type { AdminVerificarResponse } from '#shared/types/profile'

definePageMeta({
  layout: 'default'
})

const { data, pending, error } = await useFetch<AdminVerificarResponse>('/api/admin/verificar', {
  server: false
})

const isAdmin = computed(() => data.value?.isAdmin === true)

const erroTexto = computed(() => {
  const e = error.value as Error & { data?: { statusMessage?: string; message?: string } } | null
  if (!e) return null
  return e.data?.statusMessage ?? e.data?.message ?? e.message ?? 'Não foi possível verificar o acesso.'
})
</script>

<template>
  <AdminAcessoNegado v-if="!pending && !erroTexto && !isAdmin" />

  <div
    v-else-if="pending"
    class="mx-auto max-w-7xl px-4 py-16 text-center text-sm text-on-surface-variant dark:text-dark-on-surface-variant md:px-6"
  >
    Verificando permissões...
  </div>

  <div
    v-else-if="erroTexto"
    class="mx-auto max-w-lg px-4 py-16 text-center md:px-6"
  >
    <p class="text-sm text-danger dark:text-dark-danger">
      {{ erroTexto }}
    </p>
  </div>

  <div v-else class="mx-auto max-w-7xl px-4 py-8 md:px-6">
    <header class="mb-8">
      <p
        class="mb-2 inline-flex items-center gap-2 rounded-full border border-outline/40 bg-surface-container-high px-3 py-1 text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:border-dark-outline/40 dark:bg-dark-surface-container-high dark:text-dark-on-surface-variant"
      >
        <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path
            d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"
            stroke-linejoin="round"
          />
          <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" stroke-linejoin="round" />
        </svg>
        Painel administrativo
      </p>
      <h1 class="font-headline text-2xl font-bold text-on-surface dark:text-dark-on-surface">
        Admin
      </h1>
      <p class="mt-1 font-body text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
        Escolha o que deseja configurar no sistema
      </p>
    </header>

    <div class="space-y-10">
      <section
        class="rounded-2xl border border-outline/40 bg-surface-container-lowest p-6 shadow-sm dark:border-dark-outline/40 dark:bg-dark-surface-container-low md:p-8"
      >
        <SeletorPagina />
      </section>
    </div>
  </div>
</template>
