<script setup lang="ts">
defineProps<{
  selecionado: boolean
  titulo: string
  detalhe?: string
}>()

defineEmits<{
  selecionar: []
}>()
</script>

<template>
  <button
    type="button"
    class="flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left"
    :class="
      selecionado
        ? 'border-[#00C853]'
        : 'border-outline/30 dark:border-dark-outline/30'
    "
    @click="$emit('selecionar')"
  >
    <span class="flex h-6 w-6 shrink-0 items-center justify-center text-on-surface-variant dark:text-dark-on-surface-variant">
      <slot name="icon" />
    </span>
    <span class="min-w-0 flex-1">
      <span class="block text-sm font-medium text-on-surface dark:text-dark-on-surface">{{ titulo }}</span>
      <span v-if="detalhe" class="block text-xs text-red-500">{{ detalhe }}</span>
    </span>
    <span
      class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border"
      :class="selecionado ? 'border-[#00C853]' : 'border-outline/50 dark:border-dark-outline/50'"
    >
      <span v-if="selecionado" class="h-2.5 w-2.5 rounded-full bg-[#00C853]" />
    </span>
  </button>
</template>
