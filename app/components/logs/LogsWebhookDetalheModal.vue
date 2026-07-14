<script setup lang="ts">
import { computed } from 'vue'
import BaseModal from '~/components/BaseModal.vue'
import type { WebhookExecucaoRow } from '#shared/types/webhookExecucao'

const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  execucao: (WebhookExecucaoRow & { canal_nome?: string | null }) | null
  carregando?: boolean
}>()

const titulo = computed(() => {
  if (!props.execucao) return 'Detalhe da execução'
  return `Execução · ${props.execucao.event_type || 'webhook'}`
})

function formatarJson(value: unknown): string {
  if (value == null) return '—'
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function formatarData(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(d)
}
</script>

<template>
  <BaseModal v-model:open="open" :title="titulo" panel-class="w-full max-w-3xl">
    <template #subtitle>
      Auditoria completa da execução do webhook.
    </template>

    <div v-if="carregando" class="py-8 text-center text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
      Carregando detalhe…
    </div>

    <div v-else-if="!execucao" class="py-8 text-center text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
      Nenhum detalhe disponível.
    </div>

    <div v-else class="max-h-[70dvh] space-y-4 overflow-y-auto pr-1 text-sm">
      <dl class="grid gap-3 sm:grid-cols-2">
        <div>
          <dt class="text-xs font-semibold text-on-surface-variant dark:text-dark-on-surface-variant">Status</dt>
          <dd class="mt-0.5 font-medium text-on-surface dark:text-dark-on-surface">{{ execucao.status }}</dd>
        </div>
        <div>
          <dt class="text-xs font-semibold text-on-surface-variant dark:text-dark-on-surface-variant">Canal</dt>
          <dd class="mt-0.5 text-on-surface dark:text-dark-on-surface">
            {{ execucao.canal_nome || execucao.id_canal || '—' }}
          </dd>
        </div>
        <div>
          <dt class="text-xs font-semibold text-on-surface-variant dark:text-dark-on-surface-variant">Início</dt>
          <dd class="mt-0.5 text-on-surface dark:text-dark-on-surface">{{ formatarData(execucao.iniciado_em) }}</dd>
        </div>
        <div>
          <dt class="text-xs font-semibold text-on-surface-variant dark:text-dark-on-surface-variant">Fim</dt>
          <dd class="mt-0.5 text-on-surface dark:text-dark-on-surface">{{ formatarData(execucao.finalizado_em) }}</dd>
        </div>
        <div>
          <dt class="text-xs font-semibold text-on-surface-variant dark:text-dark-on-surface-variant">Telefone</dt>
          <dd class="mt-0.5 font-mono text-on-surface dark:text-dark-on-surface">{{ execucao.phone || '—' }}</dd>
        </div>
        <div>
          <dt class="text-xs font-semibold text-on-surface-variant dark:text-dark-on-surface-variant">Tipo da mensagem</dt>
          <dd class="mt-0.5 text-on-surface dark:text-dark-on-surface">{{ execucao.message_type || '—' }}</dd>
        </div>
        <div>
          <dt class="text-xs font-semibold text-on-surface-variant dark:text-dark-on-surface-variant">Message ID</dt>
          <dd class="mt-0.5 break-all text-on-surface dark:text-dark-on-surface">{{ execucao.message_id || '—' }}</dd>
        </div>
        <div class="sm:col-span-2">
          <dt class="text-xs font-semibold text-on-surface-variant dark:text-dark-on-surface-variant">Conversa</dt>
          <dd class="mt-0.5 break-all text-on-surface dark:text-dark-on-surface">{{ execucao.conversa_key || '—' }}</dd>
        </div>
        <div v-if="execucao.erro_mensagem" class="sm:col-span-2">
          <dt class="text-xs font-semibold text-red-600 dark:text-red-400">Erro</dt>
          <dd class="mt-0.5 whitespace-pre-wrap text-red-600 dark:text-red-400">{{ execucao.erro_mensagem }}</dd>
        </div>
        <div v-if="execucao.motivo_ignorado" class="sm:col-span-2">
          <dt class="text-xs font-semibold text-on-surface-variant dark:text-dark-on-surface-variant">Motivo ignorado</dt>
          <dd class="mt-0.5 text-on-surface dark:text-dark-on-surface">{{ execucao.motivo_ignorado }}</dd>
        </div>
      </dl>

      <div v-if="execucao.etapas?.length">
        <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
          Etapas
        </h3>
        <ul class="space-y-2">
          <li
            v-for="(etapa, i) in execucao.etapas"
            :key="`${etapa.etapa}-${i}`"
            class="rounded-xl border border-outline/30 px-3 py-2 dark:border-dark-outline/30"
          >
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="font-medium text-on-surface dark:text-dark-on-surface">{{ etapa.etapa }}</span>
              <span
                class="text-xs font-semibold"
                :class="etapa.ok ? 'text-emerald-600' : 'text-red-600'"
              >
                {{ etapa.ok ? 'OK' : 'Falhou' }}
                <span v-if="etapa.ms != null"> · {{ etapa.ms }} ms</span>
              </span>
            </div>
          </li>
        </ul>
      </div>

      <div>
        <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
          Payload
        </h3>
        <pre class="overflow-x-auto rounded-xl bg-slate-950 p-3 text-xs text-slate-100">{{ formatarJson(execucao.payload) }}</pre>
      </div>

      <div v-if="execucao.resposta">
        <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
          Resposta
        </h3>
        <pre class="overflow-x-auto rounded-xl bg-slate-950 p-3 text-xs text-slate-100">{{ formatarJson(execucao.resposta) }}</pre>
      </div>
    </div>
  </BaseModal>
</template>
