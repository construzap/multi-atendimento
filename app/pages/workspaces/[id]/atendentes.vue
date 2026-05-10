<script setup lang="ts">
import { computed } from 'vue'
import AtendentesGrid from '~/components/atendentes/AtendentesGrid.vue'

definePageMeta({
  layout: 'workspace',
})

const route = useRoute()
const workspaceId = computed(() => Number(route.params.id))
</script>

<template>
  <div class="mx-auto max-w-7xl space-y-6 px-4 py-8 md:px-6">
    <header class="space-y-1">
      <h1 class="font-headline text-2xl font-bold text-on-surface dark:text-dark-on-surface">
        Atendentes
      </h1>
      <p class="font-body text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
        Gerencie quem pode atender neste workspace
      </p>
    </header>

    <AtendentesGrid :workspace-id="workspaceId" />
  </div>
</template>
