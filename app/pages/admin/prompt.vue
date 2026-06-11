<script setup lang="ts">
import SeletorPrompt from '~/components/admin/prompt/SeletorPrompt.vue'

definePageMeta({
  layout: 'admin-seletor-empresa',
})
</script>

<template>
  <div class="flex h-full min-h-0 flex-col p-4 md:p-6">
    <header class="mb-6 shrink-0">
      <h1 class="font-headline text-xl font-bold text-on-surface dark:text-dark-on-surface">
        Editor de prompts
      </h1>
      <p class="mt-1 text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
        Crie e edite múltiplos prompts para o workspace selecionado
      </p>
    </header>

    <div class="min-h-0 flex-1">
      <SeletorPrompt />
    </div>
  </div>
</template>
