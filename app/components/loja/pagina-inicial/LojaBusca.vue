<script setup lang="ts">
defineProps<{
  modelValue: string
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <div class="relative">
    <span
      class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-on-surface-variant dark:text-dark-on-surface-variant"
      aria-hidden="true"
    >
      <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3-3" stroke-linecap="round" />
      </svg>
    </span>
    <input
      type="search"
      :value="modelValue"
      :placeholder="placeholder || 'Buscar no cardápio'"
      class="w-full rounded-full border-0 bg-surface-container py-2.5 pl-10 pr-4 text-sm text-on-surface outline-none ring-1 ring-outline/30 placeholder:text-on-surface-variant focus:ring-2 focus:ring-primary-500 dark:bg-dark-surface-container dark:text-dark-on-surface dark:ring-dark-outline/40 dark:placeholder:text-dark-on-surface-variant dark:focus:ring-dark-primary"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
  </div>
</template>
