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
const phase = ref<'cleanup' | 'embed' | null>(null)
// Padrão false: envia só produtos novos ou alterados. Para reexibir a opção no front, descomente o bloco no template.
const force = ref(false)
const cleanupLogs = ref<SyncCleanupChunkResult[]>([])
const embedLogs = ref<SyncChunkResult[]>([])

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

async function sync() {
  if (syncing.value) return
  syncing.value = true
  cancelled.value = false
  cleanupLogs.value = []
  embedLogs.value = []
  phase.value = null
  abortController = new AbortController()

  let interrompido = false

  try {
    await $fetch('/api/produtos/enviar-para-ia/enviar-ia', {
      method: 'POST',
      body: { workspace_id: props.workspaceId },
      signal: abortController.signal,
    })

    phase.value = 'cleanup'
    let cleanupOffset = 0
    let cleanupDone = false
    while (!cleanupDone && !cancelled.value) {
      const chunk = await $fetch<SyncCleanupChunkResult>('/api/produtos/enviar-para-ia/sync-cleanup', {
        method: 'POST',
        body: {
          workspace_id: props.workspaceId,
          offset: cleanupOffset,
          limit: 100,
        },
        signal: abortController.signal,
      })

      cleanupLogs.value.push(chunk)
      cleanupDone = chunk.done
      if (!cleanupDone) {
        cleanupOffset = chunk.nextOffset ?? 0
      }
    }

    if (cancelled.value) {
      interrompido = true
      emit('stopped')
      return
    }

    phase.value = 'embed'
    let embedOffset = 0
    let embedDone = false
    while (!embedDone && !cancelled.value) {
      const chunk = await $fetch<SyncChunkResult>('/api/produtos/enviar-para-ia/sync', {
        method: 'POST',
        body: {
          workspace_id: props.workspaceId,
          force: force.value,
          offset: embedOffset,
          limit: 50,
        },
        signal: abortController.signal,
      })

      embedLogs.value.push(chunk)
      embedDone = chunk.done
      embedOffset = chunk.nextOffset ?? chunk.processed
    }

    if (cancelled.value) {
      interrompido = true
      emit('stopped')
    } else {
      emit('completed')
    }
  } catch (err) {
    if (cancelled.value || (err instanceof Error && err.name === 'AbortError')) {
      interrompido = true
      emit('stopped')
    } else if (!cleanupLogs.value.length && !embedLogs.value.length) {
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
  <section class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
    <h2 class="mb-3 text-sm font-semibold text-gray-700">Sincronizar produtos</h2>

    <div
      v-if="syncing"
      class="mb-4 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
      role="alert"
    >
      <span class="material-symbols-outlined shrink-0 text-[20px] text-amber-600" aria-hidden="true">
        warning
      </span>
      <p>
        <strong>Não saia desta página</strong> enquanto a indexação estiver em andamento.
        Se fechar ou navegar para outro menu, o envio será interrompido.
      </p>
    </div>

    <!-- Opção "Enviar todos os produtos de novo" oculta; force permanece false no script.
    <div class="mb-3">
      <label class="flex items-start gap-2 text-sm text-gray-700">
        <input
          v-model="force"
          type="checkbox"
          class="mt-0.5 rounded"
          :disabled="syncing"
        />
        <span>
          <span class="font-medium">Enviar todos os produtos de novo</span>
          <span class="mt-0.5 block text-xs text-gray-500">
            Desmarcado: envia só produtos novos ou que você alterou. Marcado: reenvia tudo
            (demora mais e gasta mais créditos da I.A.).
          </span>
        </span>
      </label>
    </div>
    -->

    <div class="flex flex-wrap items-center gap-2">
      <button
        type="button"
        class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="syncing"
        @click="sync"
      >
        Sincronizar para Vector Store
      </button>

      <button
        v-if="syncing"
        type="button"
        class="rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
        @click="pararSincronizacao"
      >
        Parar indexação
      </button>
    </div>

    <SyncProgressLog
      :phase="phase"
      :cleanup-logs="cleanupLogs"
      :embed-logs="embedLogs"
      :syncing="syncing"
      :cancelled="cancelled"
    />
  </section>
</template>
