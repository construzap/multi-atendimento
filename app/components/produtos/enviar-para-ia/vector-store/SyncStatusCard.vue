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
  <section
    class="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
  >
    <div class="mb-3 flex items-center justify-between">
      <h2 class="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Status da indexação</h2>
      <button
        type="button"
        class="text-xs text-primary-600 transition-colors hover:underline disabled:opacity-50 dark:text-primary-400"
        :disabled="pending"
        @click="refresh()"
      >
        Atualizar
      </button>
    </div>

    <p v-if="pending" class="text-sm text-zinc-500 dark:text-zinc-400">Carregando status…</p>
    <p v-else-if="error" class="text-sm text-red-600 dark:text-red-400">
      Não foi possível carregar o status.
    </p>

    <template v-else-if="data">
      <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Produtos
      </h3>
      <dl class="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
        <div class="rounded-md bg-zinc-100 p-3 dark:bg-zinc-900">
          <dt class="text-xs text-zinc-500 dark:text-zinc-400">Produtos ativos</dt>
          <dd class="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{{ data.total_produtos }}</dd>
        </div>
        <div class="rounded-md bg-emerald-50 p-3 dark:bg-emerald-950/40">
          <dt class="text-xs text-emerald-700 dark:text-emerald-300">Na I.A. (válidos)</dt>
          <dd class="text-xl font-semibold text-emerald-800 dark:text-emerald-200">{{ data.sincronizados }}</dd>
        </div>
        <div class="rounded-md bg-red-50 p-3 dark:bg-red-950/40">
          <dt class="text-xs text-red-700 dark:text-red-300">Excluídos na I.A.</dt>
          <dd class="text-xl font-semibold text-red-800 dark:text-red-200">{{ data.orfaos }}</dd>
        </div>
        <div class="rounded-md bg-amber-50 p-3 dark:bg-amber-950/40">
          <dt class="text-xs text-amber-700 dark:text-amber-300">Falta enviar</dt>
          <dd class="text-xl font-semibold text-amber-800 dark:text-amber-200">{{ data.pendentes }}</dd>
        </div>
      </dl>
      <p class="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        Documentos na vector store de produtos: {{ data.total_documentos }}.
      </p>

      <h3
        class="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
      >
        Termos de pesquisa
      </h3>
      <dl class="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
        <div class="rounded-md bg-zinc-100 p-3 dark:bg-zinc-900">
          <dt class="text-xs text-zinc-500 dark:text-zinc-400">Termos em uso</dt>
          <dd class="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{{ data.total_termos }}</dd>
        </div>
        <div class="rounded-md bg-emerald-50 p-3 dark:bg-emerald-950/40">
          <dt class="text-xs text-emerald-700 dark:text-emerald-300">Na I.A. (válidos)</dt>
          <dd class="text-xl font-semibold text-emerald-800 dark:text-emerald-200">
            {{ data.termos_sincronizados }}
          </dd>
        </div>
        <div class="rounded-md bg-red-50 p-3 dark:bg-red-950/40">
          <dt class="text-xs text-red-700 dark:text-red-300">Excluídos na I.A.</dt>
          <dd class="text-xl font-semibold text-red-800 dark:text-red-200">{{ data.termos_orfaos }}</dd>
        </div>
        <div class="rounded-md bg-amber-50 p-3 dark:bg-amber-950/40">
          <dt class="text-xs text-amber-700 dark:text-amber-300">Falta enviar</dt>
          <dd class="text-xl font-semibold text-amber-800 dark:text-amber-200">
            {{ data.termos_pendentes }}
          </dd>
        </div>
      </dl>
      <p class="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        Documentos na vector store de termos: {{ data.total_documentos_termos }}.
        Sincronize para remover excluídos e enviar o que falta.
      </p>
    </template>
  </section>
</template>
