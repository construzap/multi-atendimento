<script setup lang="ts">
import { ref } from 'vue'

const texto = ref('')
</script>

<template>
  <div class="mt-auto shrink-0 bg-surface-container-high p-4 dark:bg-slate-800/50">
    <div class="flex flex-col gap-2">
      <textarea
        v-model="texto"
        class="h-20 w-full resize-none rounded-lg border-none bg-white p-3 font-body text-xs focus:ring-primary dark:bg-slate-800 dark:text-slate-200"
        placeholder="Adicionar anotação..."
      />

      <div class="flex items-center justify-between">
        <div class="flex gap-2 text-on-surface-variant dark:text-slate-400">
          <button type="button" class="hover:text-primary" aria-label="Imagem">
            <span class="material-symbols-outlined text-sm" aria-hidden="true">image</span>
          </button>
          <button type="button" class="hover:text-primary" aria-label="Áudio">
            <span class="material-symbols-outlined text-sm" aria-hidden="true">mic</span>
          </button>
          <button type="button" class="hover:text-primary" aria-label="Anexo">
            <span class="material-symbols-outlined text-sm" aria-hidden="true">attachment</span>
          </button>
        </div>

        <button
          type="button"
          class="rounded-lg bg-primary px-4 py-1.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-primary/90"
        >
          Salvar
        </button>
      </div>
    </div>
  </div>
</template>
