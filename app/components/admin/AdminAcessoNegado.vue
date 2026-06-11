<script setup lang="ts">
import { NuxtLink } from '#components'
</script>

<template>
  <div
    class="mx-auto flex max-w-lg flex-col items-center px-4 py-16 text-center md:py-24"
    role="alert"
  >
    <div
      class="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-danger-container text-danger-on-container"
      aria-hidden="true"
    >
      <svg class="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path
          d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </div>

    <h1 class="font-headline text-2xl font-bold text-on-surface dark:text-dark-on-surface">
      Acesso restrito
    </h1>
    <p class="mt-3 font-body text-sm leading-relaxed text-on-surface-variant dark:text-dark-on-surface-variant">
      Esta área é exclusiva para administradores do sistema.
      Se você acredita que deveria ter acesso, entre em contato com o suporte.
    </p>

    <NuxtLink
      to="/"
      class="mt-8 inline-flex items-center gap-2 rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-600"
    >
      <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path d="M15 18l-6-6 6-6" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      Voltar aos workspaces
    </NuxtLink>
  </div>
</template>
