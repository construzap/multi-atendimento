<script setup lang="ts">
defineProps<{
  mensagem?: string
}>()
</script>

<template>
  <div
    class="mx-auto flex max-w-lg flex-col items-center px-4 py-16 md:max-w-2xl"
    role="status"
    aria-live="polite"
  >
    <span
      class="h-10 w-10 animate-spin rounded-full border-[3px] border-outline/30 border-t-primary-500 dark:border-dark-outline/40 dark:border-t-dark-primary"
      aria-hidden="true"
    />
    <p class="mt-5 text-sm font-medium text-on-surface dark:text-dark-on-surface">
      {{ mensagem || 'Carregando a loja…' }}
    </p>
    <p class="mt-1 text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
      Aguarde um instante
    </p>

    <div class="mt-10 w-full space-y-4" aria-hidden="true">
      <div
        v-for="n in 4"
        :key="n"
        class="flex gap-3 border-b border-outline/20 py-3 dark:border-dark-outline/20"
      >
        <div class="min-w-0 flex-1 space-y-2.5">
          <div
            class="h-4 w-3/4 animate-pulse rounded-md bg-surface-container dark:bg-dark-surface-container"
          />
          <div
            class="h-3 w-full animate-pulse rounded-md bg-surface-container/80 dark:bg-dark-surface-container/80"
          />
          <div
            class="h-3 w-2/3 animate-pulse rounded-md bg-surface-container/80 dark:bg-dark-surface-container/80"
          />
          <div
            class="mt-3 h-4 w-20 animate-pulse rounded-md bg-surface-container dark:bg-dark-surface-container"
          />
        </div>
        <div
          class="h-[96px] w-[96px] shrink-0 animate-pulse rounded-2xl bg-surface-container dark:bg-dark-surface-container"
        />
      </div>
    </div>
  </div>
</template>
