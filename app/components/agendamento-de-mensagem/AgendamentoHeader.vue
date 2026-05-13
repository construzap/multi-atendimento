<script setup lang="ts">
withDefaults(
  defineProps<{
    search: string
    hideSearch?: boolean
    monthLabel: string
    onPrevMonth?: () => void
    onNextMonth?: () => void
  }>(),
  { hideSearch: false },
)

const emit = defineEmits<{
  'update:search': [value: string]
}>()
</script>

<template>
  <div class="mb-6 flex flex-col items-center justify-between gap-4 md:flex-row">
    <div v-if="!hideSearch" class="relative w-full max-w-md">
      <svg
        class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant dark:text-dark-on-surface-variant"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <input
        :value="search"
        type="search"
        autocomplete="off"
        placeholder="Pesquisar mensagens agendadas..."
        class="w-full rounded-xl border border-outline/40 bg-surface-container-lowest py-2 pl-10 pr-4 text-sm text-on-surface shadow-sm placeholder:text-on-surface-variant/70 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-dark-outline/40 dark:bg-dark-surface-container-low dark:text-dark-on-surface dark:placeholder:text-dark-on-surface-variant/60 dark:focus:border-dark-primary dark:focus:ring-dark-primary"
        @input="emit('update:search', ($event.target as HTMLInputElement).value)"
      />
    </div>
    <div v-else class="hidden md:block" />

    <div class="flex w-full flex-wrap items-center justify-end gap-2 md:w-auto">
      <button
        type="button"
        class="flex h-9 w-9 items-center justify-center rounded-lg border border-outline/40 bg-surface-container-lowest shadow-sm transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-40 dark:border-dark-outline/40 dark:bg-dark-surface-container-low dark:hover:bg-dark-surface-container-high"
        :disabled="!onPrevMonth"
        aria-label="Mês anterior"
        @click="onPrevMonth?.()"
      >
        <svg class="h-4 w-4 text-on-surface-variant dark:text-dark-on-surface-variant" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>
      <span class="px-2 font-headline text-lg font-bold text-on-surface dark:text-dark-on-surface">
        {{ monthLabel }}
      </span>
      <button
        type="button"
        class="flex h-9 w-9 items-center justify-center rounded-lg border border-outline/40 bg-surface-container-lowest shadow-sm transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-40 dark:border-dark-outline/40 dark:bg-dark-surface-container-low dark:hover:bg-dark-surface-container-high"
        :disabled="!onNextMonth"
        aria-label="Próximo mês"
        @click="onNextMonth?.()"
      >
        <svg class="h-4 w-4 text-on-surface-variant dark:text-dark-on-surface-variant" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>
    </div>
  </div>
</template>
