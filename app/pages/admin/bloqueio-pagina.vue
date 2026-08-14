<script setup lang="ts">
import ListaProfiles from '~/components/admin/bloqueio-pagina/ListaProfiles.vue'

definePageMeta({
  layout: 'admin-seletor-empresa',
})
</script>

<template>
  <div class="flex h-full min-h-0 flex-col bg-white p-4 dark:bg-dark-background md:p-6">
    <header class="mb-6 shrink-0">
      <h1 class="font-headline text-xl font-bold text-on-surface dark:text-dark-on-surface">
        Bloqueio de página
      </h1>
      <p class="mt-1 text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
        Habilite ou desabilite páginas por usuário do workspace
      </p>
    </header>

    <ListaProfiles />
  </div>
</template>
