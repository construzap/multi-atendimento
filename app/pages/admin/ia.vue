<script setup lang="ts">
import PainelIa from '~/components/admin/ia/PainelIa.vue'

definePageMeta({
  layout: 'admin-seletor-empresa',
})
</script>

<template>
  <div class="flex h-full min-h-0 flex-col p-4 md:p-6">
    <header class="mb-6 shrink-0">
      <h1 class="font-headline text-xl font-bold text-on-surface dark:text-dark-on-surface">
        I.A
      </h1>
      <p class="mt-1 text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
        Configurações de inteligência artificial do workspace selecionado
      </p>
    </header>

    <PainelIa />
  </div>
</template>
