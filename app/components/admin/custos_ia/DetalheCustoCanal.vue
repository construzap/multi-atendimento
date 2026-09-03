<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import { useAdminCustosIaStore } from '~/stores/adminCustosIa'
import { mensagemErroFetch } from '~/stores/canais'

const props = defineProps<{
  canalId: number | null
}>()

const store = useAdminCustosIaStore()
const {
  detalhePending,
  detalheLoaded,
  detalheError,
  detalheNomeCanal,
  detalheWorkspaceNome,
  detalheTotalCustoBrl,
  detalheTotalLetras,
  detalheTotalMensagens,
  detalheCustoPorLetra,
  detalheCustoPorMensagem,
} = storeToRefs(store)

const dataInicio = ref('')
const dataFinal = ref('')

const inputClass =
  'rounded-lg border border-outline/40 bg-surface-container-lowest px-3 py-2 font-body text-sm text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary-100 dark:border-dark-outline/40 dark:bg-dark-surface-container-low dark:text-dark-on-surface dark:focus:border-dark-primary dark:focus:ring-dark-primary/20 dark:[color-scheme:dark]'

function dataYmdValida(raw: unknown): string | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null
  return s
}

type FiltroPeriodo =
  | { tipo: 'todos' }
  | { tipo: 'invalido' }
  | { tipo: 'periodo'; inicio: string; fim: string }

const filtroPeriodo = computed<FiltroPeriodo>(() => {
  const inicio = dataYmdValida(dataInicio.value)
  const fim = dataYmdValida(dataFinal.value)
  if (!inicio || !fim) return { tipo: 'todos' }
  if (inicio > fim) return { tipo: 'invalido' }
  return { tipo: 'periodo', inicio, fim }
})

const filtroKey = computed(() => {
  const filtro = filtroPeriodo.value
  if (filtro.tipo === 'periodo') return `periodo:${filtro.inicio}:${filtro.fim}`
  if (filtro.tipo === 'invalido') return `invalido:${dataInicio.value}:${dataFinal.value}`
  return 'todos'
})

async function carregar({ force = true } = {}) {
  const filtro = filtroPeriodo.value
  if (filtro.tipo === 'invalido') {
    toast.error('A data início deve ser anterior ou igual à data final.')
    return
  }

  try {
    await store.fetchDetalheCanal({
      canalId: props.canalId,
      dataInicio: filtro.tipo === 'periodo' ? filtro.inicio : null,
      dataFinal: filtro.tipo === 'periodo' ? filtro.fim : null,
      force,
    })
  } catch (err) {
    toast.error(mensagemErroFetch(err, 'Não foi possível carregar os custos deste canal.'))
  }
}

watch(
  () => [props.canalId, filtroKey.value] as const,
  async () => {
    await carregar({ force: true })
  },
  { immediate: true },
)

function formatBrl(value: number, maxFrac = 4): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: maxFrac,
  }).format(value)
}

function formatNum(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value)
}

function formatDataFiltro(ymd: string): string {
  const parsed = dataYmdValida(ymd)
  if (!parsed) return ymd
  const [y, m, d] = parsed.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(y, m - 1, d))
}

const resumoPeriodo = computed(() => {
  const filtro = filtroPeriodo.value
  if (filtro.tipo !== 'periodo') return 'Total do canal, sem filtro de data'
  return `${formatDataFiltro(filtro.inicio)} – ${formatDataFiltro(filtro.fim)}`
})

const cards = computed(() => [
  {
    id: 'gasto',
    label: 'Total gasto no canal',
    value: formatBrl(detalheTotalCustoBrl.value),
  },
  {
    id: 'letras',
    label: 'Total de letras',
    value: formatNum(detalheTotalLetras.value),
  },
  {
    id: 'mensagens',
    label: 'Total de mensagens',
    value: formatNum(detalheTotalMensagens.value),
  },
  {
    id: 'custo-letra',
    label: 'Custo por letra',
    value: formatBrl(detalheCustoPorLetra.value, 8),
  },
  {
    id: 'custo-mensagem',
    label: 'Custo por mensagem',
    value: formatBrl(detalheCustoPorMensagem.value, 6),
  },
])
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col gap-4">
    <div class="flex shrink-0 flex-wrap items-end justify-between gap-3">
      <div class="min-w-0 space-y-1">
        <h2 class="font-headline text-sm font-bold text-on-surface dark:text-dark-on-surface">
          {{ detalheNomeCanal || 'Canal' }}
        </h2>
        <p class="text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
          <template v-if="detalheWorkspaceNome">{{ detalheWorkspaceNome }} · </template>
          <template v-if="canalId != null">Canal ID {{ canalId }}</template>
          <template v-else>Sem canal</template>
        </p>
        <p
          v-if="detalheLoaded && !detalhePending"
          class="text-xs text-on-surface-variant dark:text-dark-on-surface-variant"
        >
          {{ resumoPeriodo }}
        </p>
      </div>

      <div class="flex flex-wrap items-end gap-2">
        <label class="flex flex-col gap-1 text-xs font-semibold text-on-surface-variant dark:text-dark-on-surface-variant">
          Data início
          <input
            v-model="dataInicio"
            type="date"
            :max="dataFinal || undefined"
            :disabled="detalhePending"
            :class="inputClass"
          >
        </label>
        <label class="flex flex-col gap-1 text-xs font-semibold text-on-surface-variant dark:text-dark-on-surface-variant">
          Data final
          <input
            v-model="dataFinal"
            type="date"
            :min="dataInicio || undefined"
            :disabled="detalhePending"
            :class="inputClass"
          >
        </label>
        <button
          type="button"
          class="rounded-lg border border-outline/40 px-2.5 py-1.5 text-xs font-semibold text-on-surface-variant transition-colors hover:border-primary-300 hover:text-primary-600 disabled:opacity-50 dark:border-dark-outline/40 dark:text-dark-on-surface-variant"
          :disabled="detalhePending"
          @click="carregar({ force: true })"
        >
          {{ detalhePending ? 'Carregando...' : 'Atualizar' }}
        </button>
      </div>
    </div>

    <div
      v-if="detalhePending && !detalheLoaded"
      class="flex flex-1 items-center justify-center py-16 text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
    >
      Carregando custos do canal...
    </div>

    <div
      v-else-if="detalheError"
      class="rounded-2xl border border-danger/30 bg-danger/5 px-4 py-6 text-sm text-danger dark:text-dark-danger"
    >
      {{ detalheError }}
    </div>

    <div v-else class="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <article
        v-for="card in cards"
        :key="card.id"
        class="min-w-0 rounded-2xl border border-outline/40 bg-surface-container-lowest p-4 shadow-sm dark:border-dark-outline/40 dark:bg-dark-surface-container-low md:p-5"
      >
        <p class="text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
          {{ card.label }}
        </p>
        <p class="mt-2 break-words font-headline text-xl font-bold text-on-surface dark:text-dark-on-surface">
          {{ card.value }}
        </p>
      </article>
    </div>
  </div>
</template>
