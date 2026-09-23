<script setup lang="ts">
defineProps<{
  titulo: string
  descricao?: string
}>()
</script>

<template>
  <div class="space-y-1">
    <h2 class="font-headline text-xl font-bold tracking-tight text-on-surface dark:text-dark-on-surface">
      {{ titulo }}
    </h2>
    <p
      v-if="descricao"
      class="font-body text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
    >
      {{ descricao }}
    </p>
  </div>
</template>
