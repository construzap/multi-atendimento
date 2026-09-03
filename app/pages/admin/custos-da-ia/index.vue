<script setup lang="ts">
import AdminAcessoNegado from '~/components/admin/pagina_inicial/AdminAcessoNegado.vue'
import ListaCustosIa from '~/components/admin/custos_ia/ListaCustosIa.vue'

definePageMeta({
  layout: 'default',
})

const { pending, isAdmin, erroTexto } = useAdminGate()
</script>

<template>
  <div class="min-h-full bg-white dark:bg-dark-background">
    <AdminAcessoNegado v-if="!pending && !erroTexto && !isAdmin" />

    <div
      v-else-if="pending"
      class="mx-auto w-full max-w-7xl px-4 py-16 text-center text-sm text-on-surface-variant dark:text-dark-on-surface-variant md:px-6"
    >
      Verificando permissões...
    </div>

    <div
      v-else-if="erroTexto"
      class="mx-auto w-full max-w-lg px-4 py-16 text-center md:px-6"
    >
      <p class="text-sm text-danger dark:text-dark-danger">
        {{ erroTexto }}
      </p>
    </div>

    <div v-else class="mx-auto w-full max-w-7xl px-4 py-8 md:px-6">
      <header class="mb-8">
        <NuxtLink
          to="/admin"
          class="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-on-surface-variant transition-colors hover:text-primary-600 dark:text-dark-on-surface-variant dark:hover:text-dark-primary"
        >
          <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          Voltar ao admin
        </NuxtLink>
        <h1 class="font-headline text-2xl font-bold text-on-surface dark:text-dark-on-surface">
          Custos da I.A
        </h1>
        <p class="mt-1 font-body text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
          Consumo e custos de tokens agregados por canal
        </p>
      </header>

      <ListaCustosIa />
    </div>
  </div>
</template>
