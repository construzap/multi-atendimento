<script setup lang="ts">
import { NuxtLink } from '#components'
</script>

<template>
  <main
    class="mx-auto max-w-3xl animate-fade-in px-4 py-8 transition-colors duration-500 ease-out-expo md:py-12 [animation-delay:60ms]"
  >
    <p
      class="font-label text-xs uppercase tracking-wide text-on-surface-variant transition-colors dark:text-dark-on-surface-variant"
    >
      Rota extra
    </p>
    <h1 class="font-headline mt-2 text-2xl font-bold text-on-surface transition-colors dark:text-dark-on-surface">
      Página page
    </h1>
    <p class="mt-3 font-body text-base text-on-surface-variant dark:text-dark-on-surface-variant">
      Rota
      <code
        class="rounded bg-surface-container px-1 py-0.5 text-sm text-primary transition-colors dark:bg-dark-surface-container dark:text-dark-primary"
      >/page</code>
      para testar navegação.
    </p>
    <NuxtLink
      id="link-back-index"
      to="/"
      class="mt-6 inline-flex rounded-lg bg-primary px-5 py-2.5 font-label text-sm text-on-primary shadow-md transition-all duration-300 ease-out-expo hover:scale-105 hover:shadow-lg active:scale-95 dark:bg-dark-primary dark:text-dark-on-primary"
    >
      Voltar ao início
    </NuxtLink>
  </main>
</template>
