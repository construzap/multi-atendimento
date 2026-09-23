<script setup lang="ts">
import { ref } from 'vue'

const codigo = ref('')
</script>

<template>
  <section class="px-4 py-5">
    <div class="flex items-center gap-3 border-b border-outline/25 pb-3 dark:border-dark-outline/25">
      <svg
        class="h-5 w-5 shrink-0 text-on-surface-variant dark:text-dark-on-surface-variant"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.7"
      >
        <path d="M20.6 12.6a2 2 0 000-2.8l-6.4-6.4a2 2 0 00-1.4-.6H5a2 2 0 00-2 2v7.8a2 2 0 00.6 1.4l6.4 6.4a2 2 0 002.8 0l8-8z" stroke-linejoin="round" />
        <circle cx="8.5" cy="8.5" r="1.2" />
      </svg>
      <input
        v-model="codigo"
        type="text"
        maxlength="40"
        placeholder="Inserir código do cupom"
        class="min-w-0 flex-1 bg-transparent text-sm text-on-surface outline-none placeholder:text-on-surface-variant dark:text-dark-on-surface dark:placeholder:text-dark-on-surface-variant"
      >
      <button
        type="button"
        class="shrink-0 text-sm font-medium text-on-surface-variant dark:text-dark-on-surface-variant"
      >
        Adicionar
      </button>
    </div>
  </section>
</template>
