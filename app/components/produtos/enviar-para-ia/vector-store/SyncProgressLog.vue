<script setup lang="ts">
import { computed } from 'vue'
import type { SyncChunkResult, SyncCleanupChunkResult } from '#shared/types/vectorStore'

type SyncPhase = 'cleanup' | 'embed' | 'termos_cleanup' | 'termos_embed' | null

const props = defineProps<{
  phase: SyncPhase
  cleanupLogs: SyncCleanupChunkResult[]
  embedLogs: SyncChunkResult[]
  termosCleanupLogs: SyncCleanupChunkResult[]
  termosEmbedLogs: SyncChunkResult[]
  syncing: boolean
  cancelled?: boolean
}>()

const ultimoCleanup = computed(() => props.cleanupLogs.at(-1) ?? null)
const ultimoEmbed = computed(() => props.embedLogs.at(-1) ?? null)
const ultimoTermosCleanup = computed(() => props.termosCleanupLogs.at(-1) ?? null)
const ultimoTermosEmbed = computed(() => props.termosEmbedLogs.at(-1) ?? null)

function chunkAtual(): SyncChunkResult | SyncCleanupChunkResult | null {
  if (props.phase === 'cleanup') return ultimoCleanup.value
  if (props.phase === 'embed') return ultimoEmbed.value
  if (props.phase === 'termos_cleanup') return ultimoTermosCleanup.value
  if (props.phase === 'termos_embed') return ultimoTermosEmbed.value
  return ultimoTermosEmbed.value ?? ultimoTermosCleanup.value ?? ultimoEmbed.value ?? ultimoCleanup.value
}

const progressoPct = computed(() => {
  const last = chunkAtual()
  if (!last?.total) return 0
  return Math.min(100, Math.round((last.processed / last.total) * 100))
})

const totalItens = computed(() => chunkAtual()?.total ?? 0)
const processados = computed(() => chunkAtual()?.processed ?? 0)

const totalRemovidos = computed(() =>
  [...props.cleanupLogs, ...props.termosCleanupLogs].reduce((s, c) => s + c.removed, 0),
)

const totalIndexados = computed(() =>
  [...props.embedLogs, ...props.termosEmbedLogs].reduce((s, c) => s + c.embedded, 0),
)

const totalIgnorados = computed(() =>
  [...props.embedLogs, ...props.termosEmbedLogs].reduce((s, c) => s + c.skipped, 0),
)

const erros = computed(() => [
  ...props.cleanupLogs.flatMap((c) => c.errors),
  ...props.embedLogs.flatMap((c) => c.errors),
  ...props.termosCleanupLogs.flatMap((c) => c.errors),
  ...props.termosEmbedLogs.flatMap((c) => c.errors),
])

const temLogs = computed(
  () =>
    props.cleanupLogs.length > 0 ||
    props.embedLogs.length > 0 ||
    props.termosCleanupLogs.length > 0 ||
    props.termosEmbedLogs.length > 0,
)

const concluido = computed(() => {
  if (props.syncing) return false
  if (!temLogs.value) return false

  const cleanupDone = props.cleanupLogs.length === 0 || (ultimoCleanup.value?.done ?? false)
  const embedDone = props.embedLogs.length === 0 || (ultimoEmbed.value?.done ?? false)
  const termosCleanupDone =
    props.termosCleanupLogs.length === 0 || (ultimoTermosCleanup.value?.done ?? false)
  const termosEmbedDone =
    props.termosEmbedLogs.length === 0 || (ultimoTermosEmbed.value?.done ?? false)

  return cleanupDone && embedDone && termosCleanupDone && termosEmbedDone
})

const interrompido = computed(() => props.cancelled && !props.syncing)

const labelFase = computed(() => {
  if (props.phase === 'cleanup') return 'Removendo produtos excluídos da I.A.…'
  if (props.phase === 'embed') return 'Enviando produtos para a I.A.…'
  if (props.phase === 'termos_cleanup') return 'Removendo termos não usados…'
  if (props.phase === 'termos_embed') return 'Enviando termos para a I.A.…'
  return ''
})

const corBarra = computed(() => {
  if (interrompido.value) return 'bg-amber-500 dark:bg-amber-400'
  if (concluido.value && !erros.value.length) return 'bg-emerald-500 dark:bg-emerald-400'
  if (erros.value.length) return 'bg-red-500 dark:bg-red-400'
  if (props.phase === 'cleanup' || props.phase === 'termos_cleanup') {
    return 'bg-orange-500 dark:bg-orange-400'
  }
  return 'bg-blue-600 dark:bg-blue-400'
})
</script>

<template>
  <section
    v-if="temLogs || syncing"
    class="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900"
  >
    <div class="mb-2 flex items-center justify-between gap-2">
      <h3 class="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Progresso da sincronização</h3>
      <span class="text-sm font-medium tabular-nums text-zinc-500 dark:text-zinc-400">{{ progressoPct }}%</span>
    </div>

    <p v-if="syncing && labelFase" class="mb-2 text-xs font-medium text-primary-600 dark:text-primary-400">
      {{ labelFase }}
    </p>

    <div
      class="h-3 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
      role="progressbar"
      :aria-valuenow="progressoPct"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <div
        class="h-full rounded-full transition-all duration-300 ease-out"
        :class="corBarra"
        :style="{ width: `${progressoPct}%` }"
      />
    </div>

    <p class="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
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

    <p
      v-if="totalRemovidos || totalIndexados || totalIgnorados"
      class="mt-1 text-xs text-zinc-500 dark:text-zinc-400"
    >
      <template v-if="totalRemovidos">{{ totalRemovidos }} removido(s)</template>
      <template v-if="totalRemovidos && (totalIndexados || totalIgnorados)"> · </template>
      <template v-if="totalIndexados">{{ totalIndexados }} indexado(s)</template>
      <template v-if="totalIndexados && totalIgnorados"> · </template>
      <template v-if="totalIgnorados">{{ totalIgnorados }} ignorado(s)</template>
    </p>

    <ul
      v-if="erros.length"
      class="mt-2 max-h-24 space-y-1 overflow-y-auto text-xs text-red-600 dark:text-red-400"
    >
      <li v-for="(err, i) in erros" :key="i">{{ err }}</li>
    </ul>
  </section>
</template>
