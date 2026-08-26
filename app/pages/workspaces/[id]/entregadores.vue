<script setup lang="ts">
import { computed } from 'vue'
import EntregadoresGrid from '~/components/entregadores/EntregadoresGrid.vue'

definePageMeta({
  layout: 'workspace',
})

const route = useRoute()
const workspaceId = computed(() => Number(route.params.id))
</script>

<template>
  <div class="mx-auto min-h-full max-w-7xl space-y-6 bg-white px-4 py-8 dark:bg-dark-background md:px-6">
    <header class="space-y-1">
      <h1 class="font-headline text-2xl font-bold text-on-surface dark:text-dark-on-surface">
        Entregadores
      </h1>
      <p class="font-body text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
        Cadastre códigos fixos para o fluxo de entrega via QR Code
      </p>
    </header>

    <EntregadoresGrid :workspace-id="workspaceId" />
  </div>
</template>
