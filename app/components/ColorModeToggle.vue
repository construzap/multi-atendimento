<script setup lang="ts">
import { useColorMode } from '~/composables/useColorMode'

const { isDark, toggle } = useColorMode()
</script>

<template>
  <button
    id="color-mode-toggle"
    type="button"
    class="group fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full border-2 border-outline/40 bg-surface-container-lowest text-primary shadow-lg ring-2 ring-surface-tint/20 transition-all duration-300 ease-out hover:scale-110 hover:shadow-xl hover:ring-primary/30 active:scale-95 dark:border-dark-outline/50 dark:bg-dark-surface-container-high dark:text-dark-primary dark:ring-dark-primary/25 dark:hover:ring-dark-primary/40"
    :aria-label="isDark ? 'Ativar modo claro' : 'Ativar modo escuro'"
    :aria-pressed="isDark"
    @click="toggle"
  >
    <span class="sr-only">{{ isDark ? 'Modo claro' : 'Modo escuro' }}</span>
    <!-- Sol -->
    <svg
      v-show="!isDark"
      class="h-7 w-7 transition-transform duration-500 group-hover:rotate-12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path
        stroke-linecap="round"
        d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41"
      />
    </svg>
    <!-- Lua -->
    <svg
      v-show="isDark"
      class="h-7 w-7 transition-transform duration-500 group-hover:-rotate-12"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
      />
    </svg>
  </button>
</template>
