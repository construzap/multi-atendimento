<script setup lang="ts">
import { computed } from 'vue'
import type { SyncChunkResult, SyncCleanupChunkResult } from '#shared/types/vectorStore'

const props = defineProps<{
  phase: 'cleanup' | 'embed' | null
  cleanupLogs: SyncCleanupChunkResult[]
  embedLogs: SyncChunkResult[]
  syncing: boolean
  cancelled?: boolean
}>()

const ultimoCleanup = computed(() => props.cleanupLogs.at(-1) ?? null)
const ultimoEmbed = computed(() => props.embedLogs.at(-1) ?? null)

const progressoPct = computed(() => {
  if (props.phase === 'cleanup') {
    const last = ultimoCleanup.value
    if (!last?.total) return 0
    return Math.min(100, Math.round((last.processed / last.total) * 100))
  }
  if (props.phase === 'embed') {
    const last = ultimoEmbed.value
    if (!last?.total) return 0
    return Math.min(100, Math.round((last.processed / last.total) * 100))
  }
  const last = ultimoEmbed.value ?? ultimoCleanup.value
  if (!last?.total) return 0
  return Math.min(100, Math.round((last.processed / last.total) * 100))
})

const totalItens = computed(() => {
  if (props.phase === 'cleanup') return ultimoCleanup.value?.total ?? 0
  if (props.phase === 'embed') return ultimoEmbed.value?.total ?? 0
  return ultimoEmbed.value?.total ?? ultimoCleanup.value?.total ?? 0
})

const processados = computed(() => {
  if (props.phase === 'cleanup') return ultimoCleanup.value?.processed ?? 0
  if (props.phase === 'embed') return ultimoEmbed.value?.processed ?? 0
  return ultimoEmbed.value?.processed ?? ultimoCleanup.value?.processed ?? 0
})

const totalRemovidos = computed(() =>
  props.cleanupLogs.reduce((s, c) => s + c.removed, 0),
)

const totalIndexados = computed(() =>
  props.embedLogs.reduce((s, c) => s + c.embedded, 0),
)

const totalIgnorados = computed(() =>
  props.embedLogs.reduce((s, c) => s + c.skipped, 0),
)

const erros = computed(() => [
  ...props.cleanupLogs.flatMap((c) => c.errors),
  ...props.embedLogs.flatMap((c) => c.errors),
])

const temLogs = computed(
  () => props.cleanupLogs.length > 0 || props.embedLogs.length > 0,
)

const concluido = computed(() => {
  if (props.syncing) return false
  if (!temLogs.value) return false
  const embedDone = props.embedLogs.length === 0 || (ultimoEmbed.value?.done ?? false)
  const cleanupDone = props.cleanupLogs.length === 0 || (ultimoCleanup.value?.done ?? false)
  return embedDone && cleanupDone
})

const interrompido = computed(() => props.cancelled && !props.syncing)

const labelFase = computed(() => {
  if (props.phase === 'cleanup') return 'Removendo produtos excluídos da I.A.…'
  if (props.phase === 'embed') return 'Enviando produtos para a I.A.…'
  return ''
})
</script>

<template>
  <section
    v-if="temLogs || syncing"
    class="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4"
  >
    <div class="mb-2 flex items-center justify-between gap-2">
      <h3 class="text-sm font-semibold text-gray-700">Progresso da sincronização</h3>
      <span class="text-sm font-medium tabular-nums text-gray-600">{{ progressoPct }}%</span>
    </div>

    <p v-if="syncing && labelFase" class="mb-2 text-xs font-medium text-blue-700">
      {{ labelFase }}
    </p>

    <div
      class="h-3 w-full overflow-hidden rounded-full bg-gray-200"
      role="progressbar"
      :aria-valuenow="progressoPct"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <div
        class="h-full rounded-full transition-all duration-300 ease-out"
        :class="
          interrompido
            ? 'bg-amber-500'
            : concluido && !erros.length
              ? 'bg-green-500'
              : erros.length
                ? 'bg-red-500'
                : phase === 'cleanup'
                  ? 'bg-orange-500'
                  : 'bg-blue-600'
        "
        :style="{ width: `${progressoPct}%` }"
      />
    </div>

    <p class="mt-2 text-xs text-gray-500">
      <template v-if="syncing">
        Processando {{ processados }} de {{ totalItens }}…
      </template>
      <template v-else-if="interrompido">
        Sincronização interrompida em {{ processados }} de {{ totalItens }}.
      </template>
      <template v-else-if="concluido">
        Concluído — {{ processados }} de {{ totalItens }} processado(s).
      </template>
      <template v-else>
        {{ processados }} de {{ totalItens }} processado(s).
      </template>
    </p>

    <p v-if="totalRemovidos || totalIndexados || totalIgnorados" class="mt-1 text-xs text-gray-500">
      <template v-if="totalRemovidos">{{ totalRemovidos }} removido(s)</template>
      <template v-if="totalRemovidos && (totalIndexados || totalIgnorados)"> · </template>
      <template v-if="totalIndexados">{{ totalIndexados }} indexado(s)</template>
      <template v-if="totalIndexados && totalIgnorados"> · </template>
      <template v-if="totalIgnorados">{{ totalIgnorados }} ignorado(s)</template>
    </p>

    <ul v-if="erros.length" class="mt-2 max-h-24 space-y-1 overflow-y-auto text-xs text-red-600">
      <li v-for="(err, i) in erros" :key="i">{{ err }}</li>
    </ul>
  </section>
</template>
