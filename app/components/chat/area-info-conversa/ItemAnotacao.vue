<script setup lang="ts">
const props = defineProps<{
  autor: string
  dataHora: string
  texto: string
  anexos?: { nome: string }[]
}>()
</script>

<template>
  <div
    class="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-4 shadow-sm dark:bg-slate-800"
  >
    <div class="mb-2 flex items-start justify-between">
      <span class="text-[10px] font-semibold text-primary">{{ props.autor }}</span>
      <span class="text-[9px] text-on-surface-variant dark:text-slate-400">{{ props.dataHora }}</span>
    </div>
    <p class="font-body text-xs text-on-surface dark:text-slate-300">
      {{ props.texto }}
    </p>

    <div v-if="props.anexos?.length" class="mt-2 flex flex-wrap gap-2">
      <div
        v-for="a in props.anexos"
        :key="a.nome"
        class="flex items-center gap-1 rounded bg-surface-container-high px-2 py-1 text-[9px] dark:bg-slate-700"
      >
        <span class="material-symbols-outlined text-[10px]" aria-hidden="true">description</span>
        <span>{{ a.nome }}</span>
      </div>
    </div>
  </div>
</template>
