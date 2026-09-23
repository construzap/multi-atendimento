<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import BaseButton from '~/components/BaseButton.vue'
import RelatoriosEntregaVsRetirada from '~/components/relatorios/RelatoriosEntregaVsRetirada.vue'
import RelatoriosFaturamentoTotal from '~/components/relatorios/RelatoriosFaturamentoTotal.vue'
import RelatoriosFiltroPeriodo from '~/components/relatorios/RelatoriosFiltroPeriodo.vue'
import RelatoriosHorariosDePico from '~/components/relatorios/RelatoriosHorariosDePico.vue'
import { imprimirRelatorios } from '~/components/relatorios/imprimirRelatorios'
import RelatoriosPagosVsPendentes from '~/components/relatorios/RelatoriosPagosVsPendentes.vue'
import RelatoriosPedidosPorFormaPagamento from '~/components/relatorios/RelatoriosPedidosPorFormaPagamento.vue'
import RelatoriosPorCanal from '~/components/relatorios/RelatoriosPorCanal.vue'
import RelatoriosPorEntregador from '~/components/relatorios/RelatoriosPorEntregador.vue'
import RelatoriosProdutosMaisVendidos from '~/components/relatorios/RelatoriosProdutosMaisVendidos.vue'
import RelatoriosSecaoTitulo from '~/components/relatorios/RelatoriosSecaoTitulo.vue'
import RelatoriosStatusDaEntrega from '~/components/relatorios/RelatoriosStatusDaEntrega.vue'
import RelatoriosTempoMedioEntrega from '~/components/relatorios/RelatoriosTempoMedioEntrega.vue'
import RelatoriosTicketMedio from '~/components/relatorios/RelatoriosTicketMedio.vue'
import RelatoriosValoresPorFormaPagamento from '~/components/relatorios/RelatoriosValoresPorFormaPagamento.vue'
import { useRelatoriosStore } from '~/stores/relatorios'
import { useWorkspacesStore } from '~/stores/workspaces'

definePageMeta({
  layout: 'workspace',
})

const route = useRoute()
const workspaces = useWorkspacesStore()
const relatorios = useRelatoriosStore()
const {
  listPending,
  listError,
  filtroDe,
  filtroAte,
  periodoAtivo,
  totalPedidos,
  faturamentoTotal,
  ticketMedio,
  tempoMedioEntregaMs,
  tempoMedioEntregaAmostra,
  pedidosPorFormaPagamento,
  valoresPorFormaPagamento,
  pagosVsPendentes,
  entregaVsRetirada,
  statusDaEntrega,
  porCanal,
  porEntregador,
  produtosMaisVendidos,
  horariosDePico,
} = storeToRefs(relatorios)

const filtroDeLocal = ref('')
const filtroAteLocal = ref('')
const imprimindo = ref(false)

const workspaceId = computed(() => {
  const fromPinia = workspaces.currentWorkspaceId
  const raw = fromPinia ?? String(route.params.id ?? '')
  const n = Number.parseInt(String(raw).trim(), 10)
  if (!Number.isFinite(n) || n < 1) return null
  return n
})

const lojaNome = computed(() => {
  const id = workspaces.currentWorkspaceId
  if (!id) return null
  const ws = workspaces.items.find((w) => String(w.id) === String(id))
  return ws?.nome?.trim() || null
})

const resumoPeriodo = computed(() => {
  if (!periodoAtivo.value) return 'Todos os pedidos prontos'
  const de = filtroDe.value
  const ate = filtroAte.value
  if (de && ate && de === ate) {
    const [y, m, d] = de.split('-')
    return `Dia ${d}/${m}/${y}`
  }
  if (de && ate) {
    const [y1, m1, d1] = de.split('-')
    const [y2, m2, d2] = ate.split('-')
    return `${d1}/${m1}/${y1} → ${d2}/${m2}/${y2}`
  }
  if (de) {
    const [y, m, d] = de.split('-')
    return `A partir de ${d}/${m}/${y}`
  }
  if (ate) {
    const [y, m, d] = ate.split('-')
    return `Até ${d}/${m}/${y}`
  }
  return 'Período filtrado'
})

function onImprimir() {
  if (listPending.value || imprimindo.value) return
  imprimindo.value = true
  try {
    imprimirRelatorios({
      lojaNome: lojaNome.value,
      periodoLabel: resumoPeriodo.value,
      totalPedidos: totalPedidos.value,
      faturamentoTotal: faturamentoTotal.value,
      ticketMedio: ticketMedio.value,
      tempoMedioEntregaMs: tempoMedioEntregaMs.value,
      tempoMedioEntregaAmostra: tempoMedioEntregaAmostra.value,
      pedidosPorForma: pedidosPorFormaPagamento.value,
      valoresPorForma: valoresPorFormaPagamento.value,
      pagosVsPendentes: pagosVsPendentes.value,
      entregaVsRetirada: entregaVsRetirada.value,
      statusDaEntrega: statusDaEntrega.value,
      porCanal: porCanal.value,
      porEntregador: porEntregador.value,
      produtosMaisVendidos: produtosMaisVendidos.value,
      horariosDePico: horariosDePico.value,
    })
  } catch (err) {
    toast.error('Não foi possível abrir a impressão.')
    console.error(err)
  } finally {
    setTimeout(() => {
      imprimindo.value = false
    }, 800)
  }
}

watch(
  workspaceId,
  async (wid, prev) => {
    if (wid == null) {
      relatorios.reset()
      filtroDeLocal.value = ''
      filtroAteLocal.value = ''
      return
    }
    if (prev != null && prev !== wid) {
      relatorios.reset()
      filtroDeLocal.value = ''
      filtroAteLocal.value = ''
    }
    filtroDeLocal.value = filtroDe.value ?? ''
    filtroAteLocal.value = filtroAte.value ?? ''
    try {
      await relatorios.ensureListLoaded(wid)
    } catch {
      if (relatorios.listError) toast.error(relatorios.listError)
    }
  },
  { immediate: true },
)

watch([filtroDe, filtroAte], ([de, ate]) => {
  filtroDeLocal.value = de ?? ''
  filtroAteLocal.value = ate ?? ''
})

async function onAplicarPeriodo() {
  const wid = workspaceId.value
  if (wid == null) return
  try {
    await relatorios.setFiltroPeriodo(
      filtroDeLocal.value || null,
      filtroAteLocal.value || null,
      wid,
    )
  } catch {
    if (relatorios.listError) toast.error(relatorios.listError)
  }
}

async function onLimparPeriodo() {
  const wid = workspaceId.value
  if (wid == null) return
  filtroDeLocal.value = ''
  filtroAteLocal.value = ''
  try {
    await relatorios.limparFiltroPeriodo(wid)
  } catch {
    if (relatorios.listError) toast.error(relatorios.listError)
  }
}

async function onAtalho(preset: 'hoje' | 'ontem' | '7dias' | '30dias') {
  const wid = workspaceId.value
  if (wid == null) return
  try {
    await relatorios.aplicarAtalho(preset, wid)
  } catch {
    if (relatorios.listError) toast.error(relatorios.listError)
  }
}
</script>

<template>
  <div
    class="relative min-h-full overflow-x-hidden pb-16 pt-6 transition-colors md:pt-10"
  >
    <div
      class="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary-50/80 via-surface to-surface dark:from-primary-500/10 dark:via-dark-background dark:to-dark-background"
      aria-hidden="true"
    />
    <div
      class="pointer-events-none absolute -left-24 top-0 h-64 w-64 rounded-full bg-primary-400/15 blur-3xl dark:bg-primary-400/10"
      aria-hidden="true"
    />
    <div
      class="pointer-events-none absolute -right-16 top-40 h-52 w-52 rounded-full bg-primary-600/10 blur-3xl dark:bg-primary-500/10"
      aria-hidden="true"
    />

    <div class="relative mx-auto max-w-6xl space-y-10 px-4 md:space-y-12 md:px-6">
      <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div class="max-w-2xl space-y-2">
          <h1 class="font-headline text-3xl font-bold tracking-tight text-on-surface dark:text-dark-on-surface md:text-4xl">
            Relatórios
          </h1>
          <p class="font-body text-base text-on-surface-variant dark:text-dark-on-surface-variant">
            Visão dos pedidos prontos — {{ resumoPeriodo.toLowerCase() }}.
          </p>
          <p
            v-if="listPending"
            class="font-body text-sm text-primary-700 dark:text-primary-400"
          >
            Carregando pedidos…
          </p>
          <p
            v-else-if="listError"
            class="font-body text-sm text-red-600 dark:text-red-400"
          >
            {{ listError }}
          </p>
          <p
            v-else
            class="font-body text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
          >
            {{ totalPedidos }} pedido{{ totalPedidos === 1 ? '' : 's' }} encontrado{{ totalPedidos === 1 ? '' : 's' }}
          </p>
        </div>

        <BaseButton
          type="button"
          variant="secondary"
          :block="false"
          :disabled="listPending || imprimindo || Boolean(listError)"
          @click="onImprimir"
        >
          <span class="inline-flex items-center gap-2">
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M6 9V2h12v7" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M6 14h12v8H6z" stroke-linejoin="round" />
            </svg>
            {{ imprimindo ? 'Abrindo…' : 'Imprimir' }}
          </span>
        </BaseButton>
      </header>

      <RelatoriosFiltroPeriodo
        v-model:filtro-de="filtroDeLocal"
        v-model:filtro-ate="filtroAteLocal"
        :atualizando="listPending"
        :periodo-ativo="periodoAtivo"
        @aplicar-periodo="onAplicarPeriodo"
        @limpar-periodo="onLimparPeriodo"
        @atalho="onAtalho"
      />

      <!-- KPIs -->
      <section class="space-y-4" aria-label="Indicadores principais">
        <RelatoriosSecaoTitulo
          titulo="Resumo"
          descricao="Números principais do período selecionado."
        />
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <RelatoriosFaturamentoTotal :delay="40" />
          <RelatoriosTicketMedio :delay="90" />
          <RelatoriosTempoMedioEntrega :delay="140" />
        </div>
      </section>

      <!-- Pagamentos -->
      <section class="space-y-4" aria-label="Pagamentos">
        <RelatoriosSecaoTitulo
          titulo="Pagamentos"
          descricao="Formas de pagamento, valores e status de quitação."
        />
        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <RelatoriosPedidosPorFormaPagamento :delay="60" />
          <RelatoriosValoresPorFormaPagamento :delay="110" />
          <RelatoriosPagosVsPendentes :delay="160" />
        </div>
      </section>

      <!-- Operação -->
      <section class="space-y-4" aria-label="Operação">
        <RelatoriosSecaoTitulo
          titulo="Operação"
          descricao="Entrega, status, canais e entregadores."
        />
        <div class="grid gap-4 md:grid-cols-2">
          <RelatoriosEntregaVsRetirada :delay="60" />
          <RelatoriosStatusDaEntrega :delay="110" />
          <RelatoriosPorCanal :delay="160" />
          <RelatoriosPorEntregador :delay="210" />
        </div>
      </section>

      <!-- Produtos e horário -->
      <section class="space-y-4" aria-label="Produtos e horários">
        <RelatoriosSecaoTitulo
          titulo="Produtos e horários"
          descricao="O que mais sai e em quais horários."
        />
        <div class="grid gap-4 md:grid-cols-2">
          <RelatoriosProdutosMaisVendidos :delay="60" />
          <RelatoriosHorariosDePico :delay="110" />
        </div>
      </section>
    </div>
  </div>
</template>
