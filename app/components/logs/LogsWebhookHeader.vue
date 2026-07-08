<script setup lang="ts">
defineProps<{
  total: number
  carregando?: boolean
}>()
</script>

<template>
  <header class="space-y-2">
    <p class="text-xs font-semibold uppercase tracking-wide text-primary-700 dark:text-primary-300">
      Auditoria
    </p>
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="font-headline text-2xl font-bold text-on-surface dark:text-dark-on-surface">
          Logs de webhook
        </h1>
        <p class="mt-1 text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
          Histórico de execuções do POST /api/webhook (Uazapi).
        </p>
      </div>
      <p
        v-if="!carregando"
        class="text-xs font-medium text-on-surface-variant dark:text-dark-on-surface-variant"
      >
        {{ total }} registro(s)
      </p>
    </div>
  </header>
</template>
