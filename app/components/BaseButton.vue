<script setup lang="ts">
import { computed } from 'vue'

type ButtonVariant = 'primary' | 'secondary'
type ButtonSize = 'md' | 'sm'

const props = withDefaults(
  defineProps<{
    type?: 'button' | 'submit' | 'reset'
    disabled?: boolean
    id?: string
    variant?: ButtonVariant
    size?: ButtonSize
  }>(),
  {
    type: 'button',
    disabled: false,
    id: undefined,
    variant: 'primary',
    size: 'md'
  }
)

const sizeClass = computed(() =>
  props.size === 'sm' ? 'px-4 py-2.5 text-sm' : 'px-5 py-3.5 text-sm'
)

const variantClass = computed(() => {
  if (props.variant === 'secondary') {
    return [
      'border border-outline/50 bg-transparent text-on-surface-variant shadow-sm',
      'hover:bg-surface-container-high hover:text-on-surface hover:shadow-md',
      'dark:border-dark-outline/50 dark:text-dark-on-surface-variant dark:hover:bg-dark-surface-container-high dark:hover:text-dark-on-surface',
      'disabled:hover:bg-transparent dark:disabled:hover:bg-transparent'
    ].join(' ')
  }

  // primary (mais sóbrio que o gradiente anterior)
  return [
    'bg-primary-600 text-white shadow-sm',
    'hover:bg-primary-700 hover:shadow-md',
    'dark:bg-primary-600 dark:hover:bg-primary-700'
  ].join(' ')
})
</script>

<template>
  <button
    :id="id"
    :type="type"
    :disabled="disabled"
    :class="[
      'w-full rounded-xl font-semibold transition-all duration-200 ease-out',
      'transform-gpu hover:-translate-y-0.5 active:translate-y-0',
      sizeClass,
      variantClass,
      'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-sm'
    ]"
  >
    <slot />
  </button>
</template>
