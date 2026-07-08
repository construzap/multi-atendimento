<script setup lang="ts">
import type { WebhookExecucaoResumo } from '#shared/types/webhookExecucao'
import LogsWebhookItem from '~/components/logs/LogsWebhookItem.vue'

defineProps<{
  execucoes: WebhookExecucaoResumo[]
  carregando?: boolean
}>()

const emit = defineEmits<{
  verDetalhe: [id: string]
}>()
</script>

<template>
  <section class="space-y-3" aria-label="Lista de execuções">
    <p v-if="carregando" class="text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
      Carregando logs…
    </p>

    <p
      v-else-if="execucoes.length === 0"
      class="rounded-xl border border-dashed border-outline/40 px-4 py-8 text-center text-sm text-on-surface-variant dark:border-dark-outline/40 dark:text-dark-on-surface-variant"
    >
      Nenhuma execução encontrada com os filtros atuais.
    </p>

    <ul v-else class="space-y-3" role="list">
      <li v-for="exec in execucoes" :key="exec.id">
        <LogsWebhookItem :execucao="exec" @ver-detalhe="emit('verDetalhe', $event)" />
      </li>
    </ul>
  </section>
</template>
