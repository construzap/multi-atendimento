<script setup lang="ts">
const mobilePane = useState<'list' | 'chat' | 'info'>('chat_mobile_pane', () => 'list')
</script>

<template>
  <div class="shrink-0 border-b border-outline-variant/10 p-6">
    <div class="flex items-center justify-between gap-3">
      <h2 class="flex items-center gap-2 font-headline font-bold text-slate-900 dark:text-slate-100">
        <span class="material-symbols-outlined text-primary" aria-hidden="true">info</span>
        Contexto do Cliente
      </h2>

      <button
        type="button"
        class="rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900 md:hidden"
        aria-label="Voltar para o chat"
        @click="mobilePane = 'list'"
      >
        Voltar
      </button>
    </div>
  </div>
</template>
