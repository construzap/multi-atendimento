<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import BaseModal from '~/components/BaseModal.vue'
import {
  formatDuracaoMs,
  labelEntregadorRelatorio,
  normalizarFormaPagamentoRelatorio,
  useRelatoriosStore,
} from '~/stores/relatorios'
import {
  parseProdutosNotificacao,
  resolveTotalOrcamento,
} from '#shared/utils/notificacaoIaProdutos'
import type { RelatorioPedidoProntoItem } from '#shared/types/relatorios'

const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  entregador: string | null
}>()

defineEmits<{
  close: []
}>()

const relatorios = useRelatoriosStore()
const { items } = storeToRefs(relatorios)

const pedidos = computed(() => {
  const label = props.entregador
  if (!label) return []
  return items.value.filter((item) => labelEntregadorRelatorio(item) === label)
})

function formatarMoeda(valor: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor)
}

function dataValida(iso: string | null | undefined) {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

function textoDiaHora(iso: string | null | undefined) {
  const d = dataValida(iso)
  if (!d) return null
  const dia = d.toLocaleDateString('pt-BR')
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h')
  return `Dia: ${dia} | Hora: ${hora}`
}

function intervalo(de: string | null | undefined, ate: string | null | undefined) {
  const ini = dataValida(de)?.getTime()
  const fim = dataValida(ate)?.getTime()
  if (ini == null || fim == null || fim < ini) return null
  return formatDuracaoMs(fim - ini)
}

function valorPedido(item: RelatorioPedidoProntoItem) {
  const n = resolveTotalOrcamento(item.total_orcamento, item.forma_pagamento)
  return n != null && Number.isFinite(n) ? n : 0
}

function nomeCliente(item: RelatorioPedidoProntoItem) {
  return item.cliente?.name?.trim() || item.cliente?.phone?.trim() || 'Cliente sem nome'
}

function inicialCliente(item: RelatorioPedidoProntoItem) {
  return nomeCliente(item).charAt(0).toUpperCase()
}

function produtos(item: RelatorioPedidoProntoItem) {
  return parseProdutosNotificacao(item.produtos).map((p) => ({
    nome: p.nome,
    qtd: p.qtd != null && Number.isFinite(p.qtd) ? p.qtd : 1,
  }))
}

type Marco = {
  id: 'criado' | 'coletado' | 'local' | 'entregue'
  label: string
  quando: string | null
  relacao: string | null
  feito: boolean
}

function marcos(item: RelatorioPedidoProntoItem): Marco[] {
  const ateColeta = intervalo(item.created_at, item.coletado_at)
  const ateLocal = intervalo(item.coletado_at, item.no_local_at)
  const ateEntrega = intervalo(item.no_local_at ?? item.coletado_at, item.entregue_at)
  const desdeEntrega = item.no_local_at ? 'o motoboy chegar' : 'a coleta'
  return [
    {
      id: 'criado',
      label: 'Pedido solicitado',
      quando: textoDiaHora(item.created_at),
      relacao: null,
      feito: Boolean(dataValida(item.created_at)),
    },
    {
      id: 'coletado',
      label: 'Pedido coletado',
      quando: textoDiaHora(item.coletado_at),
      relacao: ateColeta ? `${ateColeta} após a solicitação` : null,
      feito: Boolean(dataValida(item.coletado_at)),
    },
    {
      id: 'local',
      label: 'Motoboy chegou no local',
      quando: textoDiaHora(item.no_local_at),
      relacao: ateLocal ? `${ateLocal} após a coleta` : null,
      feito: Boolean(dataValida(item.no_local_at)),
    },
    {
      id: 'entregue',
      label: 'Pedido entregue',
      quando: textoDiaHora(item.entregue_at),
      relacao: ateEntrega ? `${ateEntrega} após ${desdeEntrega}` : null,
      feito: Boolean(dataValida(item.entregue_at)),
    },
  ]
}

function tempoTotal(item: RelatorioPedidoProntoItem) {
  return intervalo(item.created_at, item.entregue_at)
}
</script>

<template>
  <BaseModal
    v-model:open="open"
    :title="entregador || 'Entregador'"
    panel-class="w-full max-w-2xl"
    body-class="space-y-4"
    @close="$emit('close')"
  >
    <template #subtitle>
      {{ pedidos.length }} pedido{{ pedidos.length === 1 ? '' : 's' }}
    </template>

    <p
      v-if="pedidos.length === 0"
      class="font-body text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
    >
      Nenhum pedido neste período.
    </p>

    <ul v-else class="space-y-4">
      <li
        v-for="pedido in pedidos"
        :key="pedido.id"
        class="overflow-hidden rounded-2xl border border-outline/25 bg-surface dark:border-dark-outline/25 dark:bg-dark-surface"
      >
        <div class="flex items-center justify-between gap-3 border-b border-outline/15 px-4 py-3 dark:border-dark-outline/20">
          <div class="flex min-w-0 items-center gap-3">
            <img
              v-if="pedido.cliente?.photo"
              :src="pedido.cliente.photo"
              alt=""
              class="h-11 w-11 shrink-0 rounded-full object-cover"
            />
            <span
              v-else
              class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700 dark:bg-primary-500/20 dark:text-primary-300"
            >
              {{ inicialCliente(pedido) }}
            </span>
            <div class="min-w-0">
              <p class="truncate font-body text-sm font-semibold text-on-surface dark:text-dark-on-surface">
                {{ nomeCliente(pedido) }}
              </p>
              <p
                v-if="pedido.cliente?.phone"
                class="truncate font-body text-xs text-on-surface-variant dark:text-dark-on-surface-variant"
              >
                {{ pedido.cliente.phone }}
              </p>
            </div>
          </div>
          <div class="shrink-0 text-right">
            <p class="font-headline text-base font-bold tabular-nums text-on-surface dark:text-dark-on-surface">
              {{ formatarMoeda(valorPedido(pedido)) }}
            </p>
            <p class="mt-0.5 inline-flex rounded-full bg-primary-50 px-2 py-0.5 font-body text-[11px] font-semibold text-primary-700 dark:bg-primary-500/15 dark:text-primary-300">
              {{ normalizarFormaPagamentoRelatorio(pedido.forma_pagamento) }}
            </p>
          </div>
        </div>

        <div class="px-4 py-3">
          <p class="font-body text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
            Produtos
          </p>
          <ul v-if="produtos(pedido).length" class="mt-2 space-y-1">
            <li
              v-for="(produto, idx) in produtos(pedido)"
              :key="`${pedido.id}-${idx}`"
              class="flex items-baseline justify-between gap-3 font-body text-sm text-on-surface dark:text-dark-on-surface"
            >
              <span class="min-w-0 truncate">{{ produto.nome }}</span>
              <span class="shrink-0 tabular-nums text-on-surface-variant dark:text-dark-on-surface-variant">
                {{ produto.qtd }}×
              </span>
            </li>
          </ul>
          <p v-else class="mt-2 font-body text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
            Sem produtos
          </p>
        </div>

        <div class="border-t border-outline/15 px-4 py-3 dark:border-dark-outline/20">
          <div class="mb-3 flex items-baseline justify-between gap-3">
            <p class="font-body text-sm font-semibold text-on-surface dark:text-dark-on-surface">
              Status e tempo
            </p>
            <p class="font-body text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
              Total
              <span class="font-semibold text-on-surface dark:text-dark-on-surface">
                {{ tempoTotal(pedido) ?? '—' }}
              </span>
            </p>
          </div>

          <ol>
            <li
              v-for="(marco, index) in marcos(pedido)"
              :key="marco.id"
              class="flex gap-3"
            >
              <div class="flex w-8 shrink-0 flex-col items-center">
                <span
                  class="flex h-8 w-8 items-center justify-center rounded-lg"
                  :class="marco.feito
                    ? 'bg-primary-50 text-primary-600 dark:bg-primary-500/15 dark:text-primary-400'
                    : 'bg-surface-container text-on-surface-variant/50 dark:bg-dark-surface-container dark:text-dark-on-surface-variant/40'"
                >
                  <svg v-if="marco.id === 'criado'" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke-linecap="round" />
                  </svg>
                  <svg v-else-if="marco.id === 'coletado'" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <path d="M6 7h15l-1.5 9h-12z" stroke-linejoin="round" />
                    <path d="M6 7 5 4H2" stroke-linecap="round" />
                  </svg>
                  <svg v-else-if="marco.id === 'local'" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" stroke-linejoin="round" />
                    <circle cx="12" cy="10" r="2.5" />
                  </svg>
                  <svg v-else class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <path d="M20 6 9 17l-5-5" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </span>
                <span
                  v-if="index < marcos(pedido).length - 1"
                  class="my-1 w-px flex-1 bg-primary-200 dark:bg-primary-500/30"
                  :class="marco.feito ? 'min-h-4' : 'min-h-4 opacity-40'"
                />
              </div>

              <div class="min-w-0 pb-4">
                <p class="font-body text-sm font-semibold text-on-surface dark:text-dark-on-surface">
                  {{ marco.label }}
                </p>
                <p
                  class="mt-0.5 font-body text-xs"
                  :class="marco.quando
                    ? 'text-on-surface-variant dark:text-dark-on-surface-variant'
                    : 'text-on-surface-variant/70 dark:text-dark-on-surface-variant/60'"
                >
                  {{ marco.quando ?? 'Ainda não registrado' }}
                </p>
                <p
                  v-if="marco.relacao"
                  class="mt-0.5 font-body text-xs font-medium text-primary-700 dark:text-primary-400"
                >
                  {{ marco.relacao }}
                </p>
              </div>
            </li>
          </ol>
        </div>
      </li>
    </ul>
  </BaseModal>
</template>
