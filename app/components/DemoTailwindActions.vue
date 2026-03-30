<script setup lang="ts"></script>

<template>
  <div id="demo-tailwind-actions" class="space-y-3">
    <h2
      class="font-headline text-lg font-semibold text-on-surface transition-colors dark:text-dark-on-surface"
    >
      Ações semânticas
    </h2>
    <div class="flex flex-wrap gap-2">
      <button
        type="button"
        class="rounded-lg bg-success px-4 py-2 font-label text-sm text-success-on shadow-sm transition-all duration-300 ease-out-expo hover:scale-105 hover:shadow-md hover:brightness-110 active:scale-95 dark:bg-dark-success dark:text-dark-on-success"
      >
        Sucesso
      </button>
      <button
        type="button"
        class="rounded-lg bg-danger px-4 py-2 font-label text-sm text-danger-on shadow-sm transition-all duration-300 ease-out-expo hover:scale-105 hover:shadow-md hover:brightness-110 active:scale-95 dark:bg-dark-danger-container dark:text-dark-on-danger-container"
      >
        Danger
      </button>
      <button
        type="button"
        class="rounded-lg bg-warning px-4 py-2 font-label text-sm text-warning-on shadow-sm transition-all duration-300 ease-out-expo hover:scale-105 hover:shadow-md hover:brightness-110 active:scale-95 dark:bg-dark-warning-container dark:text-dark-on-warning"
      >
        Warning
      </button>
      <button
        type="button"
        class="rounded-lg bg-info px-4 py-2 font-label text-sm text-info-on shadow-sm transition-all duration-300 ease-out-expo hover:scale-105 hover:shadow-md hover:brightness-110 active:scale-95 dark:bg-dark-info-container dark:text-dark-on-info"
      >
        Info
      </button>
    </div>
    <div class="flex flex-wrap gap-2">
      <span
        class="rounded-md bg-success-container px-3 py-1 font-label text-xs text-success-on-container transition-all duration-300 hover:ring-2 hover:ring-success/40 dark:bg-dark-success-container dark:text-dark-on-success-container"
      >
        chip ok
      </span>
      <span
        class="rounded-md bg-danger-container px-3 py-1 font-label text-xs text-danger-on-container transition-all duration-300 hover:ring-2 hover:ring-danger/40 dark:bg-dark-danger-container dark:text-dark-on-danger-container"
      >
        chip erro
      </span>
    </div>
  </div>
</template>
