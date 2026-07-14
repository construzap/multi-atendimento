<script setup lang="ts">
import type { WebhookExecucaoResumo } from '#shared/types/webhookExecucao'
import LogsWebhookStatusBadge from '~/components/logs/LogsWebhookStatusBadge.vue'

const props = defineProps<{
  execucao: WebhookExecucaoResumo
}>()
const emit = defineEmits<{
  verDetalhe: [id: string]
}>()

function formatarDataHora(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

const LABELS_MESSAGETYPE: Record<string, string> = {
  audioMessage: 'Áudio',
  imageMessage: 'Imagem',
  videoMessage: 'Vídeo',
  documentMessage: 'Documento',
  documentWithCaptionMessage: 'Documento',
  stickerMessage: 'Figurinha',
  conversation: 'Texto',
  chat: 'Texto',
  extendedTextMessage: 'Texto',
  contactMessage: 'Contato',
  locationMessage: 'Localização',
  liveLocationMessage: 'Localização ao vivo',
  reactionMessage: 'Reação',
  desconhecido: 'Desconhecido',
  unknown: 'Desconhecido',
}

function labelMessagetype(tipo: string | null | undefined): string | null {
  if (!tipo?.trim()) return null
  const key = tipo.trim()
  if (LABELS_MESSAGETYPE[key]) return LABELS_MESSAGETYPE[key]
  if (key.endsWith('Message')) {
    return key.slice(0, -7)
  }
  return key
}

const resumoErro = computed(() => {
  if (props.execucao.status !== 'erro') return null
  return props.execucao.erro_mensagem ?? props.execucao.erro_etapa
})

const resumoIgnorado = computed(() => {
  if (props.execucao.status !== 'ignorado') return null
  const map: Record<string, string> = {
    event_ignored: 'Evento não é mensagem',
    canal_not_found: 'Canal não encontrado',
    message_ignored: 'Mensagem ignorada',
  }
  const motivo = props.execucao.motivo_ignorado
  return motivo ? (map[motivo] ?? motivo) : null
})

const canalExibicao = computed(() => {
  if (props.execucao.canal_nome) return props.execucao.canal_nome
  if (props.execucao.id_canal != null) return `Canal #${props.execucao.id_canal}`
  return null
})

const tipoMensagem = computed(() => labelMessagetype(props.execucao.message_type))

/** Badge do tipo — cores explícitas para contraste no dark mode (evita primary-*). */
const tipoMensagemClass =
  'bg-teal-100 text-teal-900 dark:bg-teal-900 dark:text-teal-100'

const origemLabel = computed(() => {
  const origem = props.execucao.request_origem
  if (origem === 'ngrok') return 'Dev (ngrok)'
  if (origem === 'producao') return 'Produção'
  return props.execucao.request_host ?? null
})

const origemClass = computed(() => {
  const origem = props.execucao.request_origem
  if (origem === 'ngrok') {
    return 'bg-violet-100 text-violet-900 dark:bg-violet-900 dark:text-violet-100'
  }
  if (origem === 'producao') {
    return 'bg-sky-100 text-sky-900 dark:bg-sky-900 dark:text-sky-100'
  }
  return 'bg-surface-container-high text-on-surface-variant dark:bg-dark-surface-container-high dark:text-dark-on-surface'
})
</script>

<template>
  <button
    type="button"
    class="group flex w-full flex-col gap-3 rounded-2xl border border-outline/30 bg-surface-container-lowest/90 p-4 text-left shadow-sm transition-all hover:border-primary-300/50 hover:shadow-md dark:border-dark-outline/30 dark:bg-dark-surface-container-low/80 dark:hover:border-primary-600/40 sm:flex-row sm:items-center"
    @click="emit('verDetalhe', execucao.id)"
  >
    <div class="min-w-0 flex-1 space-y-2">
      <div class="flex flex-wrap items-center gap-2">
        <LogsWebhookStatusBadge :status="execucao.status" />
        <span class="text-xs font-medium text-on-surface-variant dark:text-dark-on-surface-variant">
          {{ formatarDataHora(execucao.created_at) }}
        </span>
        <span
          v-if="tipoMensagem"
          class="rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
          :class="tipoMensagemClass"
        >
          {{ tipoMensagem }}
        </span>
        <span
          v-if="origemLabel"
          class="rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
          :class="origemClass"
        >
          {{ origemLabel }}
        </span>
      </div>

      <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span
          v-if="execucao.phone"
          class="font-mono text-on-surface dark:text-dark-on-surface"
        >
          {{ execucao.phone }}
        </span>
        <span v-if="canalExibicao" class="text-on-surface-variant dark:text-dark-on-surface-variant">
          <span v-if="execucao.phone">· </span>{{ canalExibicao }}
        </span>
        <span
          v-if="execucao.instance_name"
          class="font-mono text-xs text-on-surface-variant dark:text-dark-on-surface-variant"
        >
          {{ execucao.instance_name }}
        </span>
      </div>

      <p
        v-if="resumoErro"
        class="line-clamp-1 text-xs text-red-600 dark:text-red-400"
      >
        {{ resumoErro }}
      </p>
      <p
        v-else-if="resumoIgnorado"
        class="text-xs text-amber-700 dark:text-amber-400"
      >
        {{ resumoIgnorado }}
      </p>
      <p
        v-else-if="execucao.message_id"
        class="truncate font-mono text-xs text-on-surface-variant dark:text-dark-on-surface-variant"
      >
        msg: {{ execucao.message_id }}
      </p>
    </div>

    <div class="flex shrink-0 items-center gap-2 self-end sm:self-center">
      <span class="text-xs text-on-surface-variant opacity-0 transition-opacity group-hover:opacity-100 dark:text-dark-on-surface-variant">
        Ver detalhes
      </span>
      <span class="material-symbols-outlined text-[20px] text-on-surface-variant dark:text-dark-on-surface-variant" aria-hidden="true">
        chevron_right
      </span>
    </div>
  </button>
</template>
