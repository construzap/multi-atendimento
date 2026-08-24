<script setup lang="ts">
import GerenciarAssinaturasPainel from '~/components/admin/gerenciar_assinaturas/GerenciarAssinaturasPainel.vue'

definePageMeta({
  layout: 'admin-seletor-empresa',
})
</script>

<template>
  <div class="flex h-full min-h-0 flex-col bg-white p-4 dark:bg-dark-background md:p-6">
    <header class="mb-6 shrink-0">
      <h1 class="font-headline text-xl font-bold text-on-surface dark:text-dark-on-surface">
        Gerenciar Assinaturas
      </h1>
    </header>

    <div class="min-h-0 flex-1 overflow-y-auto">
      <GerenciarAssinaturasPainel />
    </div>
  </div>
</template>
