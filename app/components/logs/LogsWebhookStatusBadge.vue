<script setup lang="ts">
import type { WebhookExecucaoStatus } from '#shared/types/webhookExecucao'

const props = defineProps<{
  status: WebhookExecucaoStatus
}>()

const config: Record<
  WebhookExecucaoStatus,
  { label: string; class: string }
> = {
  sucesso: {
    label: 'Sucesso',
    class:
      'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  },
  erro: {
    label: 'Erro',
    class: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300',
  },
  ignorado: {
    label: 'Ignorado',
    class: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  },
  processando: {
    label: 'Processando',
    class: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300',
  },
}

const badge = computed(() => config[props.status])
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
    :class="badge.class"
  >
    <span
      v-if="status === 'processando'"
      class="h-1.5 w-1.5 animate-pulse rounded-full bg-current"
      aria-hidden="true"
    />
    {{ badge.label }}
  </span>
</template>
