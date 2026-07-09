<script setup lang="ts">
const props = defineProps<{
  count: number
}>()

const emit = defineEmits<{
  alterarCampos: []
  limpar: []
}>()
</script>

<template>
  <div
    class="fixed inset-x-0 bottom-0 z-40 border-t border-outline/30 bg-white/95 backdrop-blur dark:border-dark-outline/30 dark:bg-slate-950/90"
  >
    <div class="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3">
      <div class="min-w-0">
        <p class="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {{ props.count }} selecionado{{ props.count === 1 ? '' : 's' }}
        </p>
      </div>

      <div class="flex shrink-0 items-center gap-2">
        <button
          type="button"
          class="rounded-xl border border-outline/40 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-dark-outline/40 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          @click="emit('limpar')"
        >
          Limpar
        </button>
        <button
          type="button"
          class="rounded-xl bg-primary-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:opacity-60 dark:bg-primary-500 dark:hover:bg-primary-600"
          :disabled="props.count < 1"
          @click="emit('alterarCampos')"
        >
          Alterar campos
        </button>
      </div>
    </div>
  </div>
</template>

