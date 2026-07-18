<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { Cobranca, StatusContratoCobranca } from '#shared/types/cobranca'
import {
  defaultFusoDoNavegador,
  isIanaFusoBrasilPermitido,
} from '#shared/constants/ianaTimezonesBrasil'
import { dataHoraLocalEmFuso } from '#shared/utils/agendamentoDataUtc'
import { toast } from 'vue-sonner'
import { mensagemErroFetch, useCanaisStore } from '~/stores/canais'
import { useCobrancaStore } from '~/stores/cobranca'

const props = defineProps<{
  cobranca: Cobranca
}>()

const emit = defineEmits<{
  edit: [cobranca: Cobranca]
}>()

const cobrancaStore = useCobrancaStore()
const canaisStore = useCanaisStore()

const frequenciaCobrancaLabel: Record<string, string> = {
  diaria: 'Diária',
  semanal: 'Semanal',
  mensal: 'Mensal',
  anual: 'Anual',
}

const statusLabel: Record<StatusContratoCobranca, string> = {
  ativo: 'Ativo',
  vencida: 'Vencida',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado',
}

const alterandoStatus = ref(false)

const nomeCanal = computed(() => {
  const canal = canaisStore.items.find((c) => c.id === props.cobranca.canal_id)
  const nome = canal?.nome?.trim()
  return nome || 'Canal'
})

/** Ligado = ativo | vencida; desligado = finalizado | cancelado */
const contratoLigado = computed(() => {
  const s = props.cobranca.status_contrato
  return s === 'ativo' || s === 'vencida'
})

function vencimentoJaPassou(): boolean {
  const raw =
    cobrancaStore.getById(props.cobranca.id)?.data_vencimento ??
    props.cobranca.data_vencimento
  if (!raw) return false
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return false
  return d.getTime() <= Date.now()
}

function statusParaToggle(ligado: boolean): StatusContratoCobranca {
  const passou = vencimentoJaPassou()
  if (ligado) return passou ? 'vencida' : 'ativo'
  return passou ? 'finalizado' : 'cancelado'
}

async function alternarStatusContrato() {
  if (alterandoStatus.value) return
  const proximoLigado = !contratoLigado.value
  const status_contrato = statusParaToggle(proximoLigado)

  alterandoStatus.value = true
  try {
    const resposta = await $fetch<{
      cobranca: Pick<Cobranca, 'id' | 'status_contrato' | 'updated_at'>
    }>('/api/cobranca/atualizarstatus', {
      method: 'POST',
      body: {
        id: props.cobranca.id,
        workspace_id: props.cobranca.workspace_id,
        status_contrato,
      },
    })
    const atual = cobrancaStore.getById(props.cobranca.id) ?? props.cobranca
    cobrancaStore.updateCobranca({
      ...atual,
      status_contrato: resposta.cobranca.status_contrato,
      updated_at: resposta.cobranca.updated_at,
    })
  } catch (err) {
    toast.error(mensagemErroFetch(err, 'Não foi possível atualizar o status.'))
  } finally {
    alterandoStatus.value = false
  }
}

const fusoExibicao = computed(() => {
  const tz = props.cobranca.iana_timezone?.trim() ?? ''
  return isIanaFusoBrasilPermitido(tz) ? tz : defaultFusoDoNavegador()
})

function formatDateTimeFallback(value: string) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatIsoLocal(iso: string | null | undefined) {
  if (!iso) return '—'
  const partes = dataHoraLocalEmFuso(iso, fusoExibicao.value)
  if (!partes) return formatDateTimeFallback(iso)
  const [y, m, d] = partes.data.split('-')
  if (!y || !m || !d) return formatDateTimeFallback(iso)
  return `${d}/${m}/${y} ${partes.hora}`
}

const dataProximaLabel = computed(() =>
  formatIsoLocal(props.cobranca.data_proxima_notificacao),
)

const dataVencimentoLabel = computed(() => {
  const iso =
    cobrancaStore.getById(props.cobranca.id)?.data_vencimento ??
    props.cobranca.data_vencimento
  return formatIsoLocal(iso)
})

const frequenciaLabel = computed(() => {
  const freq =
    cobrancaStore.getById(props.cobranca.id)?.frequencia_cobranca ??
    props.cobranca.frequencia_cobranca
  if (!freq) return '—'
  return frequenciaCobrancaLabel[freq] ?? freq
})

function formatMoney(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function statusClass(status: StatusContratoCobranca) {
  if (status === 'ativo') {
    return 'bg-primary-50 text-primary-700 dark:bg-dark-primary-container/30 dark:text-dark-primary'
  }
  if (status === 'vencida') {
    return 'bg-danger/10 text-danger dark:text-dark-danger'
  }
  if (status === 'finalizado') {
    return 'bg-surface-container-high text-on-surface-variant dark:bg-dark-surface-container-high dark:text-dark-on-surface-variant'
  }
  return 'bg-danger/10 text-danger dark:text-dark-danger'
}

onMounted(() => {
  void canaisStore.ensureCanaisLoaded(props.cobranca.workspace_id)
})
</script>

<template>
  <article
    role="button"
    tabindex="0"
    class="flex cursor-pointer flex-col gap-3 rounded-2xl border border-outline/30 bg-surface-container-lowest p-4 transition hover:border-outline/50 hover:bg-surface-container-low/40 dark:border-dark-outline/30 dark:bg-dark-surface-container-low dark:hover:border-dark-outline/50 dark:hover:bg-dark-surface-container/40 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-5"
    @click="emit('edit', cobranca)"
    @keydown.enter.prevent="emit('edit', cobranca)"
    @keydown.space.prevent="emit('edit', cobranca)"
  >
    <div class="min-w-0 flex-1 space-y-2.5">
      <div class="flex flex-wrap items-center gap-2">
        <h3 class="truncate font-label text-base font-semibold text-on-surface dark:text-dark-on-surface">
          {{ cobranca.name || cobranca.phone || 'Sem nome' }}
        </h3>
        <span
          class="inline-flex rounded-full px-2.5 py-0.5 font-label text-xs font-semibold"
          :class="statusClass(cobranca.status_contrato)"
        >
          {{ statusLabel[cobranca.status_contrato] }}
        </span>
      </div>
      <p class="font-body text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
        <span v-if="cobranca.name && cobranca.phone">{{ cobranca.phone }} · </span>
        data de inicio: {{ dataVencimentoLabel }}
        <span> · {{ frequenciaLabel }}</span>
      </p>

      <div
        class="inline-flex max-w-full rounded-xl border border-primary/25 bg-primary-50/70 px-3 py-2 dark:border-dark-primary/30 dark:bg-dark-primary-container/25"
      >
        <div class="min-w-0">
          <p class="font-label text-[11px] font-semibold uppercase tracking-wide text-primary-700 dark:text-dark-primary">
            Próxima notificação
          </p>
          <p class="font-headline text-base font-bold tabular-nums text-on-surface dark:text-dark-on-surface">
            {{ dataProximaLabel }}
          </p>
        </div>
      </div>
    </div>

    <div class="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
      <div class="flex items-center justify-end">
        <button
          type="button"
          role="switch"
          :aria-checked="contratoLigado"
          :disabled="alterandoStatus"
          :aria-label="contratoLigado ? 'Desativar cobrança' : 'Ativar cobrança'"
          class="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-offset-dark-surface"
          :class="contratoLigado
            ? 'bg-emerald-500 dark:bg-emerald-500'
            : 'bg-zinc-300 dark:bg-zinc-600'"
          @click.stop="alternarStatusContrato"
        >
          <span
            aria-hidden="true"
            class="pointer-events-none absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow-md ring-1 ring-black/5 transition-[left] duration-200 ease-out dark:ring-white/10"
            :class="contratoLigado ? 'left-[calc(100%-1.4rem)]' : 'left-1'"
          />
        </button>
      </div>
      <div class="text-left sm:text-right">
        <p class="font-headline text-lg font-bold text-on-surface dark:text-dark-on-surface">
          {{ formatMoney(cobranca.valor_total) }}
        </p>
        <p class="truncate font-body text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
          {{ nomeCanal }}
        </p>
      </div>
    </div>
  </article>
</template>
