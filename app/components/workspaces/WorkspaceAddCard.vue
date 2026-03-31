<script setup lang="ts">
defineEmits<{
  click: []
}>()
</script>

<template>
  <button
    type="button"
    class="group flex h-64 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-outline/60 bg-surface-container-lowest transition-all duration-300 hover:border-primary-500 hover:bg-primary-100/30 dark:border-dark-outline/60 dark:bg-dark-surface-container-low dark:hover:border-dark-primary dark:hover:bg-dark-primary-container/10"
    @click="$emit('click')"
  >
    <span
      class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant transition-all duration-300 group-hover:scale-110 group-hover:bg-primary-100 group-hover:text-primary-600 dark:bg-dark-surface-container-high dark:text-dark-on-surface-variant dark:group-hover:bg-dark-primary-container/30 dark:group-hover:text-dark-primary"
      aria-hidden="true"
    >
      <svg class="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 5v14M5 12h14" stroke-linecap="round" />
      </svg>
    </span>
    <h3
      class="font-headline text-lg font-semibold text-on-surface-variant transition-colors group-hover:text-primary-700 dark:text-dark-on-surface-variant dark:group-hover:text-dark-primary"
    >
      Criar Workspace
    </h3>
    <p class="mt-1 max-w-[22ch] text-center font-body text-sm text-on-surface-variant/80 dark:text-dark-on-surface-variant/80">
      Adicione um novo ambiente para sua equipe
    </p>
  </button>
</template>

