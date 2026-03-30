<script setup lang="ts"></script>

<template>
  <div
    id="demo-tailwind-palette"
    class="rounded-lg border border-outline/30 bg-surface-container-low p-4 shadow-sm transition-all duration-500 ease-out-expo hover:border-primary/30 hover:shadow-md dark:border-dark-outline/40 dark:bg-dark-surface-container-low dark:hover:border-dark-primary/40"
  >
    <h2
      class="font-headline text-lg font-semibold text-on-surface transition-colors dark:text-dark-on-surface"
    >
      Paleta (surface / outline)
    </h2>
    <p class="mt-1 font-body text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
      Espaçamento: gap-3, grid cols-2 sm:cols-4 — passe o mouse nos chips.
    </p>
    <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div
        class="rounded-md bg-surface p-3 text-center text-xs text-on-surface shadow-sm transition-all duration-300 ease-out-expo hover:-translate-y-1 hover:scale-105 hover:shadow-md dark:bg-dark-surface dark:text-dark-on-surface"
      >
        surface
      </div>
      <div
        class="rounded-md bg-surface-variant p-3 text-center text-xs text-on-surface-variant shadow-sm transition-all duration-300 ease-out-expo hover:-translate-y-1 hover:scale-105 hover:shadow-md dark:bg-dark-surface-variant dark:text-dark-on-surface-variant"
      >
        variant
      </div>
      <div
        class="rounded-md bg-surface-container-high p-3 text-center text-xs text-on-surface shadow-sm transition-all duration-300 ease-out-expo hover:-translate-y-1 hover:scale-105 hover:shadow-md dark:bg-dark-surface-container-high dark:text-dark-on-surface"
      >
        high
      </div>
      <div
        class="rounded-md bg-outline/20 p-3 text-center text-xs text-outline shadow-sm transition-all duration-300 ease-out-expo hover:-translate-y-1 hover:scale-105 hover:shadow-md dark:bg-dark-outline/30 dark:text-dark-outline"
      >
        outline
      </div>
    </div>
  </div>
</template>
