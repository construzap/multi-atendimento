<script setup lang="ts">
import type { VectorStoreStatus } from '#shared/types/vectorStore'

const props = defineProps<{
  workspaceId: number
}>()

const { data, pending, error, refresh } = useFetch<VectorStoreStatus>(
  () => `/api/produtos/enviar-para-ia/status?workspace_id=${props.workspaceId}`,
  {
    key: () => `vector-store-status-${props.workspaceId}`,
    watch: [() => props.workspaceId],
  },
)

defineExpose({ refresh })
</script>

<template>
  <section class="rounded-lg border border-outline/30 bg-surface-container-lowest p-4 shadow-sm">
    <div class="mb-3 flex items-center justify-between">
      <h2 class="text-sm font-semibold text-on-surface">Status da indexação</h2>
      <button
        type="button"
        class="text-xs text-primary-600 hover:underline"
        :disabled="pending"
        @click="refresh()"
      >
        Atualizar
      </button>
    </div>

    <p v-if="pending" class="text-sm text-on-surface-variant">Carregando status…</p>
    <p v-else-if="error" class="text-sm text-danger">Não foi possível carregar o status.</p>
    <dl v-else-if="data" class="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
      <div class="rounded-md bg-surface-container-low p-3">
        <dt class="text-xs text-on-surface-variant">Produtos ativos</dt>
        <dd class="text-xl font-semibold text-on-surface">{{ data.total_produtos }}</dd>
      </div>
      <div class="rounded-md bg-success-container/60 p-3">
        <dt class="text-xs text-success-on-container">Na I.A. (válidos)</dt>
        <dd class="text-xl font-semibold text-success-on-container">{{ data.sincronizados }}</dd>
      </div>
      <div class="rounded-md bg-danger-container/60 p-3">
        <dt class="text-xs text-danger-on-container">Excluídos na I.A.</dt>
        <dd class="text-xl font-semibold text-danger-on-container">{{ data.orfaos }}</dd>
      </div>
      <div class="rounded-md bg-warning-container/60 p-3">
        <dt class="text-xs text-warning-on-container">Falta enviar</dt>
        <dd class="text-xl font-semibold text-warning-on-container">{{ data.pendentes }}</dd>
      </div>
    </dl>
    <p v-if="data" class="mt-2 text-xs text-on-surface-variant">
      Total de documentos na vector store deste workspace: {{ data.total_documentos }}.
      Sincronize para remover excluídos e enviar o que falta.
    </p>
  </section>
</template>
