<script setup lang="ts">
import { computed } from 'vue'
import ListaCanais from '~/components/workspaces/canais/ListaCanais.vue'

definePageMeta({
  layout: 'workspace'
})

const route = useRoute()
const workspaceId = computed(() => Number(route.params.id))
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-6 px-4 py-8 md:px-6">
    <header class="space-y-1">
      <h1 class="font-headline text-2xl font-bold text-on-surface dark:text-dark-on-surface">
        Meus Canais
      </h1>
      <p class="font-body text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
        Gerencie os canais de atendimento deste workspace
      </p>
    </header>

    <ListaCanais :workspace-id="workspaceId" />
  </div>
</template>
