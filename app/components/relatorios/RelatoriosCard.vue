<script setup lang="ts">
withDefaults(
  defineProps<{
    /** KPI grande (faturamento, ticket, tempo). */
    destaque?: boolean
    /** Atraso da animação de entrada (ms). */
    delay?: number
  }>(),
  {
    destaque: false,
    delay: 0,
  },
)
</script>

<template>
  <article
    class="relatorio-card group relative overflow-hidden rounded-2xl border p-5 transition-all duration-300 ease-out md:p-6"
    :class="[
      destaque
        ? 'border-primary-500/25 bg-gradient-to-br from-primary-50 to-surface-container-lowest shadow-sm dark:border-primary-400/20 dark:from-primary-500/10 dark:to-dark-surface-container-lowest'
        : 'border-outline/25 bg-surface-container-lowest shadow-sm dark:border-dark-outline/25 dark:bg-dark-surface-container-lowest',
      'hover:-translate-y-1 hover:border-primary-500/40 hover:shadow-lg hover:shadow-primary-500/10 dark:hover:border-primary-400/35 dark:hover:shadow-black/40',
    ]"
    :style="{ animationDelay: `${delay}ms` }"
  >
    <div
      class="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary-400/50 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      aria-hidden="true"
    />
    <slot />
  </article>
</template>

<style scoped>
.relatorio-card {
  animation: relatorio-card-in 0.45s ease-out both;
}

@keyframes relatorio-card-in {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .relatorio-card {
    animation: none;
  }
}
</style>
