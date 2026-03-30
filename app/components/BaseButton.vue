<script setup lang="ts">
withDefaults(
  defineProps<{
    type?: 'button' | 'submit' | 'reset'
    disabled?: boolean
    id?: string
  }>(),
  {
    type: 'button',
    disabled: false,
    id: undefined,
  },
)
</script>

<template>
  <button
    :id="id"
    :type="type"
    :disabled="disabled"
    class="w-full rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 py-3.5 font-semibold text-white shadow-lg transition-all hover:from-primary-600 hover:to-primary-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:from-primary-500 disabled:hover:to-primary-600 disabled:hover:shadow-lg"
  >
    <slot />
  </button>
</template>
