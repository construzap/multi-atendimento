<script setup lang="ts">
defineEmits<{
  click: []
}>()
</script>

<template>
  <button
    type="button"
    class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#d9dde0]"
    aria-label="Fazer login"
    @click="$emit('click')"
  >
    <svg class="h-5 w-5 text-[#3d3d3d]" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="8.2" r="3.4" />
      <path d="M5.2 18.8c.6-3.2 3.4-5.2 6.8-5.2s6.2 2 6.8 5.2c.1.5-.3 1-1 1H6.2c-.7 0-1.1-.5-1-1z" />
    </svg>
  </button>
</template>
