<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { KanbanNotificacaoIa } from '#shared/types/kanban'
import BadgeTempoEsperaPedido from './BadgeTempoEsperaPedido.vue'
import {
  formatMoedaBr,
  isPedidoComTempoEspera,
  isPedidoPronto,
  labelEntregaStatus,
  labelTipoSolicitacao,
  entregaStatusIndicadorClass,
  parseProdutosNotificacao,
  resolveTotalOrcamento,
} from './parseProdutosNotificacao'

const props = defineProps<{
  item: KanbanNotificacaoIa
  expandido: boolean
  erro?: string | null
}>()

const emit = defineEmits<{
  toggle: []
}>()

const qtdItens = computed(() => parseProdutosNotificacao(props.item.produtos).length)

const totalExibicao = computed(() =>
  resolveTotalOrcamento(props.item.total_orcamento, props.item.forma_pagamento),
)

const agoraMs = ref(Date.now())
let tickTimer: ReturnType<typeof setInterval> | null = null

const mostraTempoEspera = computed(() => isPedidoComTempoEspera(props.item))

function syncTickTimer() {
  if (mostraTempoEspera.value && !tickTimer) {
    agoraMs.value = Date.now()
    tickTimer = setInterval(() => {
      agoraMs.value = Date.now()
    }, 30_000)
  } else if (!mostraTempoEspera.value && tickTimer) {
    clearInterval(tickTimer)
    tickTimer = null
  }
}

onMounted(syncTickTimer)
onBeforeUnmount(() => {
  if (tickTimer) {
    clearInterval(tickTimer)
    tickTimer = null
  }
})
watch(mostraTempoEspera, () => syncTickTimer())

function formatData(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function textoOuTraco(v: string | null | undefined): string {
  const t = typeof v === 'string' ? v.trim() : ''
  return t || '—'
}
</script>

<template>
  <div
    class="overflow-hidden rounded-2xl border bg-surface-container-lowest shadow-sm dark:bg-dark-surface-container-low"
    :class="erro
      ? 'border-red-500 ring-1 ring-red-500/30 dark:border-red-400 dark:ring-red-400/30'
      : 'border-outline/35 dark:border-dark-outline/35'"
  >
    <p
      v-if="erro"
      class="border-b border-red-500/30 bg-red-50 px-4 py-2 text-xs font-medium text-red-700 dark:border-red-400/30 dark:bg-red-950/40 dark:text-red-300"
    >
      {{ erro }}
    </p>

    <div
      class="flex cursor-pointer items-start gap-3 px-4 py-3.5 transition-colors hover:bg-surface-container-high/50 dark:hover:bg-dark-surface-container-high/35"
      role="button"
      tabindex="0"
      :aria-expanded="expandido"
      @click="emit('toggle')"
      @keydown.enter.prevent="emit('toggle')"
      @keydown.space.prevent="emit('toggle')"
    >
      <div class="min-w-0 flex-1 space-y-2">
        <div class="flex flex-wrap items-center gap-2">
          <span class="font-headline text-base font-bold text-on-surface dark:text-dark-on-surface">
            Nº {{ item.id }}
          </span>
          <span
            class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
            :class="isPedidoPronto(item.tipo_solicitacao)
              ? 'bg-primary-500/10 text-primary-700 dark:bg-primary-400/15 dark:text-primary-300'
              : 'bg-surface-container-high text-on-surface-variant dark:bg-dark-surface-container-high dark:text-dark-on-surface-variant'"
          >
            <span
              class="h-1.5 w-1.5 rounded-full"
              :class="erro ? 'bg-red-500' : entregaStatusIndicadorClass(item.entrega_status)"
              aria-hidden="true"
            />
            {{ labelTipoSolicitacao(item.tipo_solicitacao) }}
          </span>
        </div>

        <p class="text-xs tabular-nums text-on-surface-variant dark:text-dark-on-surface-variant">
          {{ formatData(item.created_at) }}
        </p>

        <template v-if="isPedidoPronto(item.tipo_solicitacao)">
          <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
            <span class="font-semibold tabular-nums text-on-surface dark:text-dark-on-surface">
              {{ formatMoedaBr(totalExibicao) }}
            </span>
            <span class="text-on-surface-variant dark:text-dark-on-surface-variant">
              {{ textoOuTraco(item.forma_pagamento) }}
            </span>
            <span
              v-if="qtdItens > 0"
              class="text-on-surface-variant dark:text-dark-on-surface-variant"
            >
              {{ qtdItens }}
              {{ qtdItens === 1 ? 'item' : 'itens' }}
            </span>
            <span
              v-if="item.entrega_status && item.entrega_status !== 'separacao'"
              class="rounded-full bg-surface-container-high px-2 py-0.5 text-[11px] font-semibold text-on-surface-variant dark:bg-dark-surface-container-high dark:text-dark-on-surface-variant"
            >
              {{ labelEntregaStatus(item.entrega_status) }}
            </span>
          </div>
          <p
            v-if="item.endereco?.trim()"
            class="line-clamp-1 text-xs text-on-surface-variant dark:text-dark-on-surface-variant"
          >
            {{ item.endereco.trim() }}
          </p>
        </template>
        <template v-else>
          <p class="line-clamp-2 text-sm text-on-surface dark:text-dark-on-surface">
            {{ textoOuTraco(item.observacoes) }}
          </p>
        </template>
      </div>

      <div class="flex shrink-0 flex-col items-end gap-2">
        <BadgeTempoEsperaPedido
          v-if="mostraTempoEspera"
          :created-at="item.created_at"
          :now-ms="agoraMs"
          size="md"
        />
        <span
          class="material-symbols-outlined text-[20px] text-on-surface-variant dark:text-dark-on-surface-variant"
          aria-hidden="true"
        >
          {{ expandido ? 'expand_less' : 'expand_more' }}
        </span>
      </div>
    </div>

    <div
      v-if="expandido"
      class="border-t border-outline/25 px-4 py-4 dark:border-dark-outline/25"
    >
      <slot />
    </div>
  </div>
</template>
