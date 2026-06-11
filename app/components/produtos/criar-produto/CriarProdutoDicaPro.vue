<script setup lang="ts">
defineOptions({ name: 'CriarProdutoDicaPro' })
</script>

<template>
  <div class="rounded-xl border border-primary-500/20 bg-primary-500/5 p-6 dark:border-primary-400/25 dark:bg-primary-500/10">
    <div class="mb-2 flex items-center gap-3 text-primary-600 dark:text-primary-400">
      <span class="material-symbols-outlined" aria-hidden="true">lightbulb</span>
      <h3 class="text-sm font-bold">Dica Pro</h3>
    </div>
    <p class="text-sm leading-relaxed text-on-surface-variant dark:text-dark-on-surface-variant">
      Produtos com imagens de alta qualidade e descrições técnicas detalhadas convertem até
      <strong class="text-primary-600 dark:text-primary-400">40% mais</strong>
      nas vendas online.
    </p>
  </div>
</template>
