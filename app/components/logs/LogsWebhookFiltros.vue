<script setup lang="ts">
import BaseButton from '~/components/BaseButton.vue'
import type { WebhookExecucaoStatus } from '#shared/types/webhookExecucao'

const statusFiltro = defineModel<WebhookExecucaoStatus | 'todos'>('statusFiltro', { required: true })
const filtroDe = defineModel<string>('filtroDe', { required: true })
const filtroAte = defineModel<string>('filtroAte', { required: true })

defineProps<{
  atualizando?: boolean
  periodoAtivo?: boolean
}>()

const emit = defineEmits<{
  atualizar: []
  aplicarPeriodo: []
  limparPeriodo: []
}>()

const opcoesStatus: { value: WebhookExecucaoStatus | 'todos'; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'sucesso', label: 'Sucesso' },
  { value: 'erro', label: 'Erro' },
  { value: 'ignorado', label: 'Ignorado' },
  { value: 'processando', label: 'Processando' },
]
</script>

<template>
  <section
    class="space-y-4 rounded-2xl border border-outline/30 bg-surface-container-lowest p-4 dark:border-dark-outline/30 dark:bg-dark-surface-container-lowest"
    aria-label="Filtros de logs"
  >
    <div class="flex flex-wrap items-end gap-3">
      <div class="min-w-[10rem] flex-1">
        <label
          class="mb-1.5 block text-xs font-semibold text-on-surface dark:text-dark-on-surface"
          for="logs-status"
        >
          Status
        </label>
        <select
          id="logs-status"
          v-model="statusFiltro"
          class="w-full rounded-xl border border-outline/40 bg-surface px-3 py-2.5 text-sm text-on-surface dark:border-dark-outline/40 dark:bg-dark-surface dark:text-dark-on-surface"
        >
          <option v-for="op in opcoesStatus" :key="op.value" :value="op.value">
            {{ op.label }}
          </option>
        </select>
      </div>

      <div class="w-full sm:w-auto sm:shrink-0">
        <BaseButton
          type="button"
          variant="secondary"
          :block="false"
          :disabled="atualizando"
          @click="emit('atualizar')"
        >
          {{ atualizando ? 'Atualizando…' : 'Atualizar' }}
        </BaseButton>
      </div>
    </div>

    <div class="grid gap-3 sm:grid-cols-2">
      <div>
        <label
          class="mb-1.5 block text-xs font-semibold text-on-surface dark:text-dark-on-surface"
          for="logs-de"
        >
          De
        </label>
        <input
          id="logs-de"
          v-model="filtroDe"
          type="datetime-local"
          class="w-full rounded-xl border border-outline/40 bg-surface px-3 py-2.5 text-sm text-on-surface dark:border-dark-outline/40 dark:bg-dark-surface dark:text-dark-on-surface"
        />
      </div>
      <div>
        <label
          class="mb-1.5 block text-xs font-semibold text-on-surface dark:text-dark-on-surface"
          for="logs-ate"
        >
          Até
        </label>
        <input
          id="logs-ate"
          v-model="filtroAte"
          type="datetime-local"
          class="w-full rounded-xl border border-outline/40 bg-surface px-3 py-2.5 text-sm text-on-surface dark:border-dark-outline/40 dark:bg-dark-surface dark:text-dark-on-surface"
        />
      </div>
    </div>

    <div class="flex flex-wrap gap-2">
      <BaseButton type="button" :block="false" :disabled="atualizando" @click="emit('aplicarPeriodo')">
        Aplicar período
      </BaseButton>
      <BaseButton
        v-if="periodoAtivo"
        type="button"
        variant="secondary"
        :block="false"
        :disabled="atualizando"
        @click="emit('limparPeriodo')"
      >
        Limpar período
      </BaseButton>
    </div>
  </section>
</template>
