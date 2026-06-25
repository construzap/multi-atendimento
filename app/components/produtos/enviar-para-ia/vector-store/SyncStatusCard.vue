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
  <section class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
    <div class="mb-3 flex items-center justify-between">
      <h2 class="text-sm font-semibold text-gray-700">Status da indexação</h2>
      <button
        type="button"
        class="text-xs text-blue-600 hover:underline"
        :disabled="pending"
        @click="refresh()"
      >
        Atualizar
      </button>
    </div>

    <p v-if="pending" class="text-sm text-gray-500">Carregando status…</p>
    <p v-else-if="error" class="text-sm text-red-600">Não foi possível carregar o status.</p>
    <dl v-else-if="data" class="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
      <div class="rounded-md bg-gray-50 p-3">
        <dt class="text-xs text-gray-500">Produtos ativos</dt>
        <dd class="text-xl font-semibold text-gray-900">{{ data.total_produtos }}</dd>
      </div>
      <div class="rounded-md bg-green-50 p-3">
        <dt class="text-xs text-green-700">Na I.A. (válidos)</dt>
        <dd class="text-xl font-semibold text-green-800">{{ data.sincronizados }}</dd>
      </div>
      <div class="rounded-md bg-red-50 p-3">
        <dt class="text-xs text-red-700">Excluídos na I.A.</dt>
        <dd class="text-xl font-semibold text-red-800">{{ data.orfaos }}</dd>
      </div>
      <div class="rounded-md bg-amber-50 p-3">
        <dt class="text-xs text-amber-700">Falta enviar</dt>
        <dd class="text-xl font-semibold text-amber-800">{{ data.pendentes }}</dd>
      </div>
    </dl>
    <p v-if="data" class="mt-2 text-xs text-gray-400">
      Total de documentos na vector store deste workspace: {{ data.total_documentos }}.
      Sincronize para remover excluídos e enviar o que falta.
    </p>
  </section>
</template>
