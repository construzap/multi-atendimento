<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { toast } from 'vue-sonner'
import type { SyncChunkResult, SyncCleanupChunkResult } from '#shared/types/vectorStore'
import SyncProgressLog from '~/components/produtos/enviar-para-ia/vector-store/SyncProgressLog.vue'
import { mensagemErroFetch } from '~/stores/canais'

const props = defineProps<{
  workspaceId: number
}>()

const emit = defineEmits<{
  completed: []
  stopped: []
}>()

const syncing = ref(false)
const cancelled = ref(false)
const phase = ref<'cleanup' | 'embed' | 'termos_cleanup' | 'termos_embed' | null>(null)
const force = ref(false)
const cleanupLogs = ref<SyncCleanupChunkResult[]>([])
const embedLogs = ref<SyncChunkResult[]>([])
const termosCleanupLogs = ref<SyncCleanupChunkResult[]>([])
const termosEmbedLogs = ref<SyncChunkResult[]>([])

let abortController: AbortController | null = null

function avisoSairPagina(e: BeforeUnloadEvent) {
  e.preventDefault()
  e.returnValue = ''
}

watch(syncing, (ativo) => {
  if (!import.meta.client) return
  if (ativo) {
    window.addEventListener('beforeunload', avisoSairPagina)
  } else {
    window.removeEventListener('beforeunload', avisoSairPagina)
  }
})

onBeforeUnmount(() => {
  if (import.meta.client) {
    window.removeEventListener('beforeunload', avisoSairPagina)
  }
  pararSincronizacao()
})

onBeforeRouteLeave(() => {
  if (!syncing.value) return true
  return window.confirm(
    'A indexação ainda está em andamento. Se sair agora, o envio será interrompido. Deseja sair mesmo assim?',
  )
})

async function runCleanupLoop(
  url: string,
  logs: Ref<SyncCleanupChunkResult[]>,
): Promise<boolean> {
  let offset = 0
  let done = false
  while (!done && !cancelled.value) {
    const chunk = await $fetch<SyncCleanupChunkResult>(url, {
      method: 'POST',
      body: {
        workspace_id: props.workspaceId,
        offset,
        limit: 100,
      },
      signal: abortController!.signal,
    })

    logs.value.push(chunk)
    done = chunk.done
    if (!done) {
      offset = chunk.nextOffset ?? 0
    }
  }
  return cancelled.value
}

async function runEmbedLoop(
  url: string,
  logs: Ref<SyncChunkResult[]>,
): Promise<boolean> {
  let offset = 0
  let done = false
  while (!done && !cancelled.value) {
    const chunk = await $fetch<SyncChunkResult>(url, {
      method: 'POST',
      body: {
        workspace_id: props.workspaceId,
        force: force.value,
        offset,
        limit: 50,
      },
      signal: abortController!.signal,
    })

    logs.value.push(chunk)
    done = chunk.done
    offset = chunk.nextOffset ?? chunk.processed
  }
  return cancelled.value
}

async function sync() {
  if (syncing.value) return
  syncing.value = true
  cancelled.value = false
  cleanupLogs.value = []
  embedLogs.value = []
  termosCleanupLogs.value = []
  termosEmbedLogs.value = []
  phase.value = null
  abortController = new AbortController()

  let interrompido = false

  try {
    await $fetch('/api/produtos/enviar-para-ia/envia-produtos-para-n8n', {
      method: 'POST',
      body: { workspace_id: props.workspaceId },
      signal: abortController.signal,
    })

    phase.value = 'cleanup'
    if (await runCleanupLoop('/api/produtos/enviar-para-ia/sync-cleanup', cleanupLogs)) {
      interrompido = true
      emit('stopped')
      return
    }

    phase.value = 'embed'
    if (await runEmbedLoop('/api/produtos/enviar-para-ia/envia-produtos-para-vectorstore', embedLogs)) {
      interrompido = true
      emit('stopped')
      return
    }

    phase.value = 'termos_cleanup'
    if (
      await runCleanupLoop(
        '/api/produtos/enviar-para-ia/enviar-termos-pesquisa/sync-cleanup',
        termosCleanupLogs,
      )
    ) {
      interrompido = true
      emit('stopped')
      return
    }

    phase.value = 'termos_embed'
    if (
      await runEmbedLoop(
        '/api/produtos/enviar-para-ia/enviar-termos-pesquisa/envia-termos-para-vectorstore',
        termosEmbedLogs,
      )
    ) {
      interrompido = true
      emit('stopped')
      return
    }

    emit('completed')
  } catch (err) {
    if (cancelled.value || (err instanceof Error && err.name === 'AbortError')) {
      interrompido = true
      emit('stopped')
    } else if (
      !cleanupLogs.value.length &&
      !embedLogs.value.length &&
      !termosCleanupLogs.value.length &&
      !termosEmbedLogs.value.length
    ) {
      toast.error(mensagemErroFetch(err, 'Não foi possível iniciar o envio para a I.A.'))
    } else {
      const msg = err instanceof Error ? err.message : 'Erro na sincronização.'
      if (phase.value === 'cleanup') {
        cleanupLogs.value.push({
          total: cleanupLogs.value.at(-1)?.total ?? 0,
          processed: cleanupLogs.value.at(-1)?.processed ?? 0,
          removed: 0,
          errors: [msg],
          done: true,
          nextOffset: null,
        })
      } else if (phase.value === 'termos_cleanup') {
        termosCleanupLogs.value.push({
          total: termosCleanupLogs.value.at(-1)?.total ?? 0,
          processed: termosCleanupLogs.value.at(-1)?.processed ?? 0,
          removed: 0,
          errors: [msg],
          done: true,
          nextOffset: null,
        })
      } else if (phase.value === 'termos_embed') {
        termosEmbedLogs.value.push({
          total: termosEmbedLogs.value.at(-1)?.total ?? 0,
          processed: termosEmbedLogs.value.at(-1)?.processed ?? 0,
          embedded: 0,
          skipped: 0,
          errors: [msg],
          done: true,
          nextOffset: null,
        })
      } else {
        embedLogs.value.push({
          total: embedLogs.value.at(-1)?.total ?? 0,
          processed: embedLogs.value.at(-1)?.processed ?? 0,
          embedded: 0,
          skipped: 0,
          errors: [msg],
          done: true,
          nextOffset: null,
        })
      }
    }
  } finally {
    syncing.value = false
    phase.value = null
    abortController = null
    if (interrompido) cancelled.value = true
  }
}

function pararSincronizacao() {
  if (!syncing.value) return
  cancelled.value = true
  abortController?.abort()
}

defineExpose({ syncing })
</script>

<template>
  <section
    class="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
  >
    <h2 class="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Sincronizar produtos</h2>

    <div
      v-if="syncing"
      class="mb-4 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100"
      role="alert"
    >
      <span
        class="material-symbols-outlined shrink-0 text-[20px] text-amber-600 dark:text-amber-400"
        aria-hidden="true"
      >
        warning
      </span>
      <p>
        <strong>Não saia desta página</strong> enquanto a indexação estiver em andamento.
        Se fechar ou navegar para outro menu, o envio será interrompido.
      </p>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <button
        type="button"
        class="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-primary-500 dark:text-zinc-950 dark:hover:bg-primary-400"
        :disabled="syncing"
        @click="sync"
      >
        Sincronizar para Vector Store
      </button>

      <button
        v-if="syncing"
        type="button"
        class="rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-900/50 dark:bg-zinc-950 dark:text-red-400 dark:hover:bg-red-950/30"
        @click="pararSincronizacao"
      >
        Parar indexação
      </button>
    </div>

    <SyncProgressLog
      :phase="phase"
      :cleanup-logs="cleanupLogs"
      :embed-logs="embedLogs"
      :termos-cleanup-logs="termosCleanupLogs"
      :termos-embed-logs="termosEmbedLogs"
      :syncing="syncing"
      :cancelled="cancelled"
    />
  </section>
</template>
