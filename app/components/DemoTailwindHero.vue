<script setup lang="ts"></script>

<template>
  <section
    id="demo-tailwind-hero"
    class="group relative overflow-hidden rounded-xl bg-gradient-to-br from-primary-container to-secondary-container p-6 shadow-md transition-all duration-500 ease-out-expo hover:shadow-glow md:p-8 dark:from-dark-primary-container dark:to-dark-secondary-container dark:shadow-glow-dark dark:hover:shadow-xl"
  >
    <div
      class="pointer-events-none absolute inset-0 rounded-xl opacity-0 ring-2 ring-inset ring-white/25 transition-all duration-500 group-hover:opacity-100 dark:ring-white/10"
    />
    <p
      class="font-label text-sm font-medium uppercase tracking-wide text-on-primary-container transition-colors dark:text-dark-on-primary-container"
    >
      Multi-atendimento
    </p>
    <h1
      class="font-headline mt-2 text-2xl font-bold text-on-primary-container transition-transform duration-500 ease-out-expo group-hover:translate-x-1 md:text-3xl dark:text-dark-on-primary-container"
    >
      Teste do Tailwind
    </h1>
    <p class="mt-3 max-w-xl text-base text-on-primary-container/90 dark:text-dark-on-primary-container/90">
      Tokens de cor, tipografia e sombras do design system — hero com gradiente primary → secondary.
    </p>
    <div class="mt-6 flex flex-wrap gap-3">
      <span
        class="inline-flex rounded-full bg-surface-container-lowest/90 px-4 py-2 font-label text-sm text-on-surface shadow-sm transition-all duration-300 hover:scale-105 hover:shadow-md dark:bg-dark-surface-container-lowest/90 dark:text-dark-on-surface"
      >
        rounded-full
      </span>
      <span
        class="inline-flex animate-float rounded-bubble bg-tertiary-container px-4 py-2 font-label text-sm text-on-tertiary shadow-sm transition-transform duration-300 hover:scale-110 dark:bg-dark-tertiary-container dark:text-dark-on-tertiary"
      >
        rounded-bubble
      </span>
    </div>
  </section>
</template>
