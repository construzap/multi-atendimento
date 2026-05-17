<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import AgendamentoCalendar from '~/components/agendamento-de-mensagem/AgendamentoCalendar.vue'
import AgendamentoHeader from '~/components/agendamento-de-mensagem/AgendamentoHeader.vue'
import AgendamentosDiaSidebar from '~/components/agendamento-de-mensagem/AgendamentosDiaSidebar.vue'
import CriarAgendamentoModal from '~/components/agendamento-de-mensagem/CriarAgendamentoModal.vue'
import type { AgendamentoMensagemRow } from '#shared/types/agendamentoMensagens'
import type { AgendamentoDiaItem, CalendarEvent } from '~/components/agendamento-de-mensagem/types'
import { agendamentosMensagensMonthKey, useAgendamentosMensagensStore } from '~/stores/agendamentosMensagens'

definePageMeta({
  layout: 'workspace',
})

const route = useRoute()
const agStore = useAgendamentosMensagensStore()

function parsePositiveInt(raw: unknown): number | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  const n = Number.parseInt(s, 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return null
  if (String(n) !== s) return null
  return n
}

const workspaceId = computed(() => parsePositiveInt(route.params.id))

const mesAtual = ref(new Date())
const busca = ref('')
const diaSelecionado = ref<number | null>(null)
const modalAberto = ref(false)

const labelMes = computed(() =>
  new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(mesAtual.value),
)

const itensMesAtual = computed(() => {
  const d = mesAtual.value
  return agStore.itensDoMes(d.getFullYear(), d.getMonth() + 1)
})

const carregandoMes = computed(() => {
  const d = mesAtual.value
  return agStore.estaCarregandoMes(d.getFullYear(), d.getMonth() + 1)
})

const agendamentosFiltrados = computed(() => {
  const q = busca.value.trim().toLowerCase()
  if (!q) return itensMesAtual.value
  return itensMesAtual.value.filter((a) => {
    const blob = [
      a.nomecliente,
      a.telefone,
      a.mensagem_texto,
      a.status,
      a.mensagem_type,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return blob.includes(q)
  })
})

const eventsByDay = computed<Partial<Record<number, CalendarEvent[]>>>(() => {
  const y = mesAtual.value.getFullYear()
  const m = mesAtual.value.getMonth()
  const map: Partial<Record<number, CalendarEvent[]>> = {}
  for (const a of agendamentosFiltrados.value) {
    const d = new Date(a.data_agendada)
    if (d.getFullYear() !== y || d.getMonth() !== m) continue
    const day = d.getDate()
    const titulo =
      (a.nomecliente ?? '').trim() || (a.telefone ?? '').trim() || 'Agendamento'
    if (!map[day]) map[day] = []
    map[day]!.push({
      id: String(a.id),
      title: titulo.length > 28 ? `${titulo.slice(0, 28)}…` : titulo,
      color: 'primary',
      recorrente: a.recorrente,
    })
  }
  return map
})

const itensDiaSelecionado = computed(() => {
  if (diaSelecionado.value == null) return []
  const y = mesAtual.value.getFullYear()
  const m = mesAtual.value.getMonth()
  const day = diaSelecionado.value
  return agendamentosFiltrados.value
    .filter((a) => {
      const d = new Date(a.data_agendada)
      return d.getFullYear() === y && d.getMonth() === m && d.getDate() === day
    })
    .sort((a, b) => new Date(a.data_agendada).getTime() - new Date(b.data_agendada).getTime())
})

const prefillDataIso = computed(() => {
  if (diaSelecionado.value == null) return null
  const y = mesAtual.value.getFullYear()
  const m = mesAtual.value.getMonth()
  const d = diaSelecionado.value
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
})

watch(
  () => [workspaceId.value, mesAtual.value.getFullYear(), mesAtual.value.getMonth()] as const,
  async ([wid, y, m0]) => {
    if (wid == null) return
    try {
      await agStore.carregarMesSeNecessario(wid, y, m0 + 1)
    } catch {
      const key = agendamentosMensagensMonthKey(y, m0 + 1)
      toast.error(agStore.erroMes[key] ?? 'Não foi possível carregar os agendamentos.')
    }
  },
  { immediate: true },
)

function mesAnterior() {
  const d = mesAtual.value
  mesAtual.value = new Date(d.getFullYear(), d.getMonth() - 1, 1)
}

function mesProximo() {
  const d = mesAtual.value
  mesAtual.value = new Date(d.getFullYear(), d.getMonth() + 1, 1)
}

function aoClicarDia(day: number) {
  diaSelecionado.value = day
}

function abrirCriar() {
  agStore.limparAgendamentoSelecionado()
  modalAberto.value = true
}

function abrirEditar(item: AgendamentoDiaItem) {
  agStore.setAgendamentoSelecionado(item)
  modalAberto.value = true
}

function aoCriadoAgendamento(row: AgendamentoMensagemRow) {
  agStore.limparAgendamentoSelecionado()
  const wid = workspaceId.value
  if (wid == null) return
  const ry = new Date(row.data_agendada).getFullYear()
  const rm = new Date(row.data_agendada).getMonth() + 1
  agStore.invalidarMes(ry, rm)
  const vy = mesAtual.value.getFullYear()
  const vm = mesAtual.value.getMonth() + 1
  if (vy === ry && vm === rm) {
    void agStore.carregarMesSeNecessario(wid, vy, vm)
  }
}

function aoAtualizadoAgendamento(row: AgendamentoMensagemRow) {
  const old = agStore.agendamentoSelecionado
  agStore.limparAgendamentoSelecionado()
  const wid = workspaceId.value
  modalAberto.value = false

  if (old) {
    const oy = new Date(old.data_agendada).getFullYear()
    const om = new Date(old.data_agendada).getMonth() + 1
    agStore.invalidarMes(oy, om)
  }

  const ry = new Date(row.data_agendada).getFullYear()
  const rm = new Date(row.data_agendada).getMonth() + 1
  agStore.invalidarMes(ry, rm)

  const vy = mesAtual.value.getFullYear()
  const vm = mesAtual.value.getMonth() + 1
  if (wid != null) {
    void agStore.carregarMesSeNecessario(wid, vy, vm)
  }
}
</script>

<template>
  <div class="min-h-full bg-background pb-14 pt-6 transition-colors dark:bg-dark-background md:pt-10">
    <div class="mx-auto max-w-7xl px-4 md:px-6">
      <header class="mb-8 max-w-3xl space-y-3">
        <p class="text-sm font-medium text-on-surface-variant dark:text-dark-on-surface-variant">
          Workspace
          <template v-if="workspaceId != null">
            · ID {{ workspaceId }}
          </template>
        </p>
        <h1 class="font-headline text-3xl font-bold tracking-tight text-on-surface dark:text-dark-on-surface md:text-4xl">
          Agendamento de mensagens
        </h1>
        <p class="font-body text-base leading-relaxed text-on-surface-variant dark:text-dark-on-surface-variant md:text-lg">
          Criar e editar agendamentos sincronizam com o servidor.
        </p>
      </header>

      <AgendamentoHeader
        v-model:search="busca"
        :month-label="labelMes"
        :on-prev-month="mesAnterior"
        :on-next-month="mesProximo"
      />
      <p
        v-if="carregandoMes"
        class="-mt-2 mb-4 text-xs text-on-surface-variant dark:text-dark-on-surface-variant"
      >
        Carregando agendamentos do mês…
      </p>

      <div class="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div class="min-h-[min(70vh,640px)] min-w-0 flex-1">
          <AgendamentoCalendar
            :month-date="mesAtual"
            :highlighted-day="diaSelecionado ?? undefined"
            :events-by-day="eventsByDay"
            @day-click="aoClicarDia"
          />
        </div>

        <AgendamentosDiaSidebar
          :open="diaSelecionado != null"
          :day="diaSelecionado"
          :month-date="mesAtual"
          :items="itensDiaSelecionado"
          @close="diaSelecionado = null"
          @create-click="abrirCriar"
          @edit-click="abrirEditar"
        />
      </div>
    </div>

    <CriarAgendamentoModal
      v-model:open="modalAberto"
      :prefill-date="prefillDataIso"
      @criado="aoCriadoAgendamento"
      @atualizado="aoAtualizadoAgendamento"
      @cancelar="agStore.limparAgendamentoSelecionado()"
    />
  </div>
</template>
