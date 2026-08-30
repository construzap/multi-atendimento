<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import type {
  KanbanCard as KanbanCardModel,
  KanbanColumn,
} from '#shared/types/kanban'
import type {
  AtualizarMensagemProntaResponse,
  CriarMensagemProntaResponse,
  MensagemProntaListaItem,
} from '#shared/types/mensagensProntas'
import BaseDropdown from '~/components/ui/BaseDropdown.vue'
import { mensagemErroFetch } from '~/stores/canais'
import { useKanbanStore } from '~/stores/kanban'
import { useProfileStore } from '~/stores/profile'
import DropdownMensagensProntas from './mensagem_pronta/DropdownMensagensProntas.vue'
import ModalCriarMensagemPronta from './mensagem_pronta/ModalCriarMensagemPronta.vue'
import { createdAtEsperaMaisAntiga } from './notificacoes_ia/parseProdutosNotificacao'
import KanbanCard from './KanbanCard.vue'

const props = defineProps<{
  workspaceId: number
  column: KanbanColumn
  draggingId?: string | null
  dragOverColumnId?: string | number | null
  podeMoverEsquerda?: boolean
  podeMoverDireita?: boolean
  reordenando?: boolean
  carregandoMais?: boolean
  selectedKeys?: string[]
  forceShowCheckboxes?: boolean
}>()

const emit = defineEmits<{
  columnDrop: [payload: { toColumnId: string | number; raw: string }]
  columnDragOver: [payload: { toColumnId: string | number }]
  columnDragLeave: [payload: { toColumnId: string | number }]
  cardDragStart: [payload: { cardId: string; fromColumnId: string }]
  cardDragEnd: []
  columnEdit: [column: KanbanColumn]
  columnDelete: [column: KanbanColumn]
  columnReorder: [payload: { columnId: number; direcao: 'esquerda' | 'direita' }]
  loadMore: [columnId: number]
  cardOpen: [card: KanbanCardModel]
  cardToggleSelected: [payload: { conversa_key: string; nextSelected: boolean }]
  columnToggleSelectAll: [payload: { keys: string[]; nextSelected: boolean }]
}>()

const kanban = useKanbanStore()
const profile = useProfileStore()
const isAdmin = computed(() => profile.isAdminConfirmado)
const { columns } = storeToRefs(kanban)

/** Submenu "Mover coluna" dentro do dropdown da engrenagem. */
const menuMoverAberto = ref(false)
/** Submenu de mensagens prontas (agendamento) — só admin (mesmo critério do menu). */
const menuProntasAberto = ref(false)
const modalMensagemProntaAberto = ref(false)
const sequenciaIdModal = ref<string | null>(null)
const criandoAgendamentoColuna = ref(false)

const temAgendamentoAutomatico = computed(() => {
  const id = props.column.id_agendamento_mensagem
  return typeof id === 'string' && id.trim().length > 0
})

const recolhida = computed(() => props.column.recolhida === true)
const toggleRecolhidaPending = ref(false)

/** Largura real da coluna (desktop + recolher outras → mais espaço → fonte maior). */
const colunaRootRef = ref<HTMLElement | null>(null)
const larguraColunaPx = ref(0)
let colunaResizeObserver: ResizeObserver | null = null

const colunasAbertas = computed(
  () => columns.value.filter((c) => c.recolhida !== true).length,
)

/**
 * Fonte do nome: prioriza largura medida da coluna; fallback = qtd. de colunas abertas.
 * Ao recolher colunas, as abertas ficam mais largas e a fonte sobe.
 */
const nomeTituloClass = computed(() => {
  const w = larguraColunaPx.value
  if (w >= 300) return 'text-base leading-snug'
  if (w >= 240) return 'text-sm leading-snug'
  if (w >= 190) return 'text-xs leading-snug'
  if (w >= 150) return 'text-[11px] leading-snug'
  if (w > 0) return 'text-[10px] leading-snug'

  const n = colunasAbertas.value
  if (n <= 3) return 'text-base leading-snug'
  if (n <= 4) return 'text-sm leading-snug'
  if (n <= 5) return 'text-xs leading-snug'
  if (n <= 7) return 'text-[11px] leading-snug'
  return 'text-[10px] leading-snug'
})

onMounted(() => {
  const el = colunaRootRef.value
  if (!el || typeof ResizeObserver === 'undefined') return
  const aplicar = (width: number) => {
    larguraColunaPx.value = width
  }
  aplicar(el.getBoundingClientRect().width)
  colunaResizeObserver = new ResizeObserver((entries) => {
    const entry = entries[0]
    if (!entry) return
    aplicar(entry.contentRect.width)
  })
  colunaResizeObserver.observe(el)
})

onBeforeUnmount(() => {
  colunaResizeObserver?.disconnect()
  colunaResizeObserver = null
})

async function toggleRecolhida() {
  if (!props.workspaceId || toggleRecolhidaPending.value) return
  toggleRecolhidaPending.value = true
  try {
    await kanban.toggleColunaRecolhida({
      workspaceId: props.workspaceId,
      colunaId: props.column.id,
    })
  } finally {
    toggleRecolhidaPending.value = false
  }
}

async function onAgendamentoExcluido() {
  if (!props.workspaceId || props.column.id_agendamento_mensagem == null) return
  await kanban.vincularAgendamentoColuna({
    workspaceId: props.workspaceId,
    colunaId: props.column.id,
    nome: props.column.nome,
    cor: props.column.cor,
    id_agendamento_mensagem: null,
  })
}

function uuidOuNulo(raw: unknown): string | null {
  if (raw == null || raw === '') return null
  const s = String(raw).trim()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return null
  return s
}

function onEditar(close: () => void) {
  close()
  menuMoverAberto.value = false
  menuProntasAberto.value = false
  emit('columnEdit', props.column)
}

function onExcluir(close: () => void) {
  close()
  menuMoverAberto.value = false
  menuProntasAberto.value = false
  emit('columnDelete', props.column)
}

function abrirMenuMover() {
  menuMoverAberto.value = true
  menuProntasAberto.value = false
}

function abrirMenuProntas() {
  menuProntasAberto.value = true
  menuMoverAberto.value = false
}

function voltarMenuPrincipal() {
  menuMoverAberto.value = false
  menuProntasAberto.value = false
}

function abrirCriarMensagemPronta(close: () => void) {
  sequenciaIdModal.value = null
  modalMensagemProntaAberto.value = true
  close()
}

function abrirEditarMensagemPronta(item: MensagemProntaListaItem, close: () => void) {
  sequenciaIdModal.value = item.id
  modalMensagemProntaAberto.value = true
  close()
}

async function onMensagemProntaSalva(
  res: CriarMensagemProntaResponse | AtualizarMensagemProntaResponse,
) {
  if (!props.workspaceId || criandoAgendamentoColuna.value) return

  const sequenciaId = uuidOuNulo(res.sequencia.id)
  if (!sequenciaId) {
    toast.error('Não foi possível vincular o agendamento: id inválido.')
    return
  }

  if (props.column.id_agendamento_mensagem === sequenciaId) return

  criandoAgendamentoColuna.value = true
  try {
    const ok = await kanban.vincularAgendamentoColuna({
      workspaceId: props.workspaceId,
      colunaId: props.column.id,
      nome: props.column.nome,
      cor: props.column.cor,
      id_agendamento_mensagem: sequenciaId,
    })
    if (ok) toast.success('Agendamento vinculado à coluna.')
  } catch (err: unknown) {
    toast.error(mensagemErroFetch(err, 'Não foi possível vincular o agendamento à coluna.'))
  } finally {
    criandoAgendamentoColuna.value = false
  }
}

function emitReorder(direcao: 'esquerda' | 'direita', close: () => void) {
  if (props.reordenando) return
  if (direcao === 'esquerda' && !props.podeMoverEsquerda) return
  if (direcao === 'direita' && !props.podeMoverDireita) return
  close()
  menuMoverAberto.value = false
  emit('columnReorder', { columnId: props.column.id, direcao })
}

function onDropdownOpenChange(aberto: boolean) {
  if (!aberto) {
    menuMoverAberto.value = false
    menuProntasAberto.value = false
  }
}

const columnSurfaceStyle = computed(() => {
  const c = props.column.cor?.trim()
  if (!c) return {}
  const hex = /^#([0-9a-fA-F]{6})$/.test(c) ? c : null
  if (hex) {
    return { backgroundColor: `${hex}18` }
  }
  return { backgroundColor: `${c}18` }
})

const isDragOver = computed(
  () => props.dragOverColumnId != null && String(props.dragOverColumnId) === String(props.column.id),
)

/**
 * 1) Com badge de espera (`BadgeTempoEsperaPedido`) → no topo, mais atrasado primeiro.
 * 2) Sem badge → `updated_at` mais recente primeiro; empate → `conversa_key` A→Z.
 */
const cardsOrdenados = computed(() =>
  [...props.column.cards].sort((a, b) => {
    const esperaA = createdAtEsperaMaisAntiga(a.notificacoes_ia)
    const esperaB = createdAtEsperaMaisAntiga(b.notificacoes_ia)
    const temEsperaA = esperaA != null
    const temEsperaB = esperaB != null

    if (temEsperaA && !temEsperaB) return -1
    if (!temEsperaA && temEsperaB) return 1

    if (temEsperaA && temEsperaB) {
      const ta = new Date(esperaA).getTime()
      const tb = new Date(esperaB).getTime()
      // Mais antigo (mais atrasado) primeiro
      if (ta !== tb) return ta - tb
    }

    const ua = a.updated_at ? new Date(a.updated_at).getTime() : 0
    const ub = b.updated_at ? new Date(b.updated_at).getTime() : 0
    if (ub !== ua) return ub - ua
    return a.conversa_key.localeCompare(b.conversa_key)
  }),
)

const selectedSet = computed(() => new Set((props.selectedKeys ?? []).map((k) => String(k).trim()).filter(Boolean)))

const keysDaColuna = computed(() =>
  cardsOrdenados.value.map((card) => card.conversa_key.trim()).filter(Boolean),
)

const selecionadosNaColuna = computed(
  () => keysDaColuna.value.filter((key) => selectedSet.value.has(key)).length,
)

const todosSelecionadosNaColuna = computed(
  () => keysDaColuna.value.length > 0 && selecionadosNaColuna.value === keysDaColuna.value.length,
)

const algunsSelecionadosNaColuna = computed(
  () => selecionadosNaColuna.value > 0 && !todosSelecionadosNaColuna.value,
)

const checkboxSelecionarTodosColuna = ref<HTMLInputElement | null>(null)

watch(
  [todosSelecionadosNaColuna, algunsSelecionadosNaColuna],
  () => {
    const el = checkboxSelecionarTodosColuna.value
    if (el) el.indeterminate = algunsSelecionadosNaColuna.value
  },
  { immediate: true },
)

function onToggleSelecionarTodosColuna() {
  const keys = keysDaColuna.value
  if (keys.length === 0) return
  emit('columnToggleSelectAll', {
    keys,
    nextSelected: !todosSelecionadosNaColuna.value,
  })
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
  emit('columnDragOver', { toColumnId: props.column.id })
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
}

function onDragLeave(e: DragEvent) {
  const el = e.currentTarget
  const related = e.relatedTarget
  if (
    el instanceof HTMLElement &&
    related instanceof Node &&
    el.contains(related)
  ) {
    return
  }
  emit('columnDragLeave', { toColumnId: props.column.id })
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  const raw = e.dataTransfer?.getData('text/plain') ?? ''
  emit('columnDrop', { toColumnId: props.column.id, raw })
}
</script>

<template>
  <!-- drop/dragover na section inteira: sobre outro card o evento não chega no inner div -->
  <section
    ref="colunaRootRef"
    class="flex h-full min-h-0 min-w-0 flex-col rounded-3xl dark:bg-slate-900/30"
    :class="recolhida ? 'items-center px-1.5 py-3' : 'p-4'"
    :style="columnSurfaceStyle"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <!-- Coluna recolhida: faixa estreita -->
    <template v-if="recolhida">
      <button
        type="button"
        class="mb-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-white/70 disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-800/80"
        :disabled="toggleRecolhidaPending"
        :aria-label="`Expandir coluna ${column.nome}`"
        title="Expandir coluna"
        @click.stop="toggleRecolhida"
      >
        <span class="material-symbols-outlined text-[20px]" aria-hidden="true">
          keyboard_double_arrow_right
        </span>
      </button>
      <span
        class="mb-2 rounded-full bg-white/80 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-slate-700 shadow-sm dark:bg-slate-800/70 dark:text-slate-200"
      >
        {{ column.total_cards ?? column.cards.length }}
      </span>
      <div
        class="flex min-h-0 flex-1 cursor-pointer flex-col items-center justify-start overflow-hidden"
        role="button"
        tabindex="0"
        :aria-label="`Expandir ${column.nome}`"
        @click="toggleRecolhida"
        @keydown.enter.prevent="toggleRecolhida"
      >
        <span
          class="max-h-full origin-center text-[11px] font-bold tracking-wide text-slate-800 dark:text-dark-on-surface"
          style="writing-mode: vertical-rl; text-orientation: mixed; transform: rotate(180deg);"
          :title="column.nome"
        >
          {{ column.nome }}
        </span>
      </div>
      <!-- Área de drop mesmo recolhida -->
      <div
        class="mt-2 h-8 w-full shrink-0 rounded-lg border border-dashed border-outline/40 dark:border-dark-outline/40"
        :class="isDragOver ? 'ring-2 ring-primary/25' : ''"
        aria-hidden="true"
        @dragenter="onDragOver"
        @dragover="onDragOver"
        @drop="onDrop"
      />
    </template>

    <template v-else>
    <header class="mb-3 flex min-w-0 flex-col gap-2">
      <div class="relative flex min-w-0 items-start justify-center">
        <label
          v-if="props.forceShowCheckboxes && keysDaColuna.length > 0"
          class="absolute left-0 top-0 z-10 shrink-0 cursor-pointer"
          :title="todosSelecionadosNaColuna ? 'Desmarcar todos desta coluna' : 'Selecionar todos desta coluna'"
          @click.stop
          @mousedown.stop
        >
          <input
            ref="checkboxSelecionarTodosColuna"
            type="checkbox"
            class="peer sr-only"
            :checked="todosSelecionadosNaColuna"
            @change="onToggleSelecionarTodosColuna"
          />
          <span
            class="flex h-7 w-7 items-center justify-center rounded-lg border border-outline/45 bg-white/90 text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-dark-outline/45 dark:bg-slate-950/80 dark:text-slate-200 dark:hover:bg-slate-900"
            :class="todosSelecionadosNaColuna || algunsSelecionadosNaColuna ? 'ring-2 ring-primary/25' : ''"
            aria-hidden="true"
          >
            <span
              class="flex h-3.5 w-3.5 items-center justify-center rounded border-2 transition-colors"
              :class="
                todosSelecionadosNaColuna
                  ? 'border-primary bg-primary text-white'
                  : algunsSelecionadosNaColuna
                    ? 'border-primary bg-primary/20'
                    : 'border-slate-300 bg-transparent dark:border-slate-600'
              "
            >
              <svg
                v-if="todosSelecionadosNaColuna"
                class="h-3 w-3"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fill-rule="evenodd"
                  d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.25 7.31a1 1 0 0 1-1.42-.002l-3.25-3.29a1 1 0 1 1 1.422-1.406l2.54 2.57 6.54-6.59a1 1 0 0 1 1.412-.006Z"
                  clip-rule="evenodd"
                />
              </svg>
              <span
                v-else-if="algunsSelecionadosNaColuna"
                class="h-1.5 w-1.5 rounded-sm bg-primary"
                aria-hidden="true"
              />
            </span>
          </span>
          <span class="sr-only">Selecionar todos desta coluna</span>
        </label>
        <h2
          class="w-full min-w-0 break-words text-center font-headline font-bold text-slate-900 dark:text-dark-on-surface"
          :class="nomeTituloClass"
          lang="pt-BR"
          :title="column.nome"
        >
          {{ column.nome }}
        </h2>
      </div>

      <div class="flex min-w-0 items-center gap-0.5">
        <span
          class="rounded-full bg-white/80 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-slate-700 shadow-sm dark:bg-slate-800/70 dark:text-slate-200 sm:px-2 sm:text-[11px]"
        >
          {{ column.total_cards ?? column.cards.length }}
        </span>

        <div class="ml-auto flex shrink-0 items-center gap-0.5">
          <span
            v-if="temAgendamentoAutomatico"
            class="flex h-8 w-8 items-center justify-center text-amber-600/80 dark:text-amber-400/80"
            title="Mensagem automática ativa"
            role="img"
            aria-label="Mensagem automática ativa"
          >
            <span class="material-symbols-outlined text-[18px] leading-none" aria-hidden="true">
              schedule_send
            </span>
          </span>

          <button
            type="button"
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-white/60 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800/80"
            :disabled="toggleRecolhidaPending"
            :aria-label="`Recolher coluna ${column.nome}`"
            title="Recolher coluna"
            @click.stop="toggleRecolhida"
          >
            <span class="material-symbols-outlined text-[20px]" aria-hidden="true">
              keyboard_double_arrow_left
            </span>
          </button>

          <div v-if="isAdmin" class="shrink-0" @click.stop @mousedown.stop>
            <BaseDropdown
              title="Etapa"
              align="right"
              side="bottom"
              panel-class="w-72 min-w-[16rem] max-w-[calc(100vw-2rem)]"
              @open-change="onDropdownOpenChange"
            >
              <template #trigger>
                <span
                  class="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-white/60 dark:hover:bg-slate-800/80"
                >
                  <span
                    class="material-symbols-outlined text-[20px] text-slate-600 dark:text-slate-400"
                    aria-hidden="true"
                  >
                    settings
                  </span>
                  <span class="sr-only">Configurações da etapa</span>
                </span>
              </template>

            <template #default="{ close }">
              <DropdownMensagensProntas
                v-if="menuProntasAberto"
                :workspace-id="workspaceId"
                :id-agendamento-mensagem="column.id_agendamento_mensagem"
                @voltar="voltarMenuPrincipal"
                @criar="abrirCriarMensagemPronta(close)"
                @editar="(item) => abrirEditarMensagemPronta(item, close)"
                @excluido="onAgendamentoExcluido"
              />

              <template v-else-if="menuMoverAberto">
                <button
                  type="button"
                  role="menuitem"
                  class="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-high dark:text-dark-on-surface dark:hover:bg-dark-surface-container-high"
                  @click="voltarMenuPrincipal"
                >
                  <span
                    class="material-symbols-outlined text-[20px] text-on-surface-variant dark:text-dark-on-surface-variant"
                    aria-hidden="true"
                  >
                    arrow_back
                  </span>
                  Mover coluna
                </button>

                <div class="mx-1 my-1 border-t border-outline/30 dark:border-dark-outline/30" />

                <button
                  v-if="podeMoverEsquerda"
                  type="button"
                  role="menuitem"
                  class="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-40 dark:text-dark-on-surface dark:hover:bg-dark-surface-container-high"
                  :disabled="reordenando"
                  @click="emitReorder('esquerda', close)"
                >
                  <span
                    class="material-symbols-outlined text-[20px] text-on-surface-variant dark:text-dark-on-surface-variant"
                    aria-hidden="true"
                  >
                    chevron_left
                  </span>
                  Para a esquerda
                </button>

                <button
                  v-if="podeMoverDireita"
                  type="button"
                  role="menuitem"
                  class="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-40 dark:text-dark-on-surface dark:hover:bg-dark-surface-container-high"
                  :disabled="reordenando"
                  @click="emitReorder('direita', close)"
                >
                  <span
                    class="material-symbols-outlined text-[20px] text-on-surface-variant dark:text-dark-on-surface-variant"
                    aria-hidden="true"
                  >
                    chevron_right
                  </span>
                  Para a direita
                </button>
              </template>

              <template v-else>
                <button
                  v-if="isAdmin"
                  type="button"
                  role="menuitem"
                  class="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-high dark:text-dark-on-surface dark:hover:bg-dark-surface-container-high"
                  @click="onEditar(close)"
                >
                  <span
                    class="material-symbols-outlined text-[20px] text-on-surface-variant dark:text-dark-on-surface-variant"
                    aria-hidden="true"
                  >
                    edit
                  </span>
                  Editar
                </button>

                <button
                  v-if="isAdmin && (podeMoverEsquerda || podeMoverDireita)"
                  type="button"
                  role="menuitem"
                  class="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-high dark:text-dark-on-surface dark:hover:bg-dark-surface-container-high"
                  :disabled="reordenando"
                  @click="abrirMenuMover"
                >
                  <span
                    class="material-symbols-outlined text-[20px] text-on-surface-variant dark:text-dark-on-surface-variant"
                    aria-hidden="true"
                  >
                    swap_horiz
                  </span>
                  <span class="min-w-0 flex-1">Mover coluna</span>
                  <span
                    class="material-symbols-outlined text-[18px] text-on-surface-variant dark:text-dark-on-surface-variant"
                    aria-hidden="true"
                  >
                    chevron_right
                  </span>
                </button>

                <button
                  v-if="isAdmin"
                  type="button"
                  role="menuitem"
                  class="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-high dark:text-dark-on-surface dark:hover:bg-dark-surface-container-high"
                  @click="abrirMenuProntas"
                >
                  <span
                    class="material-symbols-outlined text-[20px] text-on-surface-variant dark:text-dark-on-surface-variant"
                    aria-hidden="true"
                  >
                    schedule_send
                  </span>
                  <span class="min-w-0 flex-1">Agendamento de mensagens</span>
                  <span
                    class="material-symbols-outlined text-[18px] text-on-surface-variant dark:text-dark-on-surface-variant"
                    aria-hidden="true"
                  >
                    chevron_right
                  </span>
                </button>

                <button
                  v-if="isAdmin"
                  type="button"
                  role="menuitem"
                  class="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                  @click="onExcluir(close)"
                >
                  <span class="material-symbols-outlined text-[20px]" aria-hidden="true">
                    delete
                  </span>
                  Excluir
                </button>
              </template>
            </template>
          </BaseDropdown>
        </div>
        </div>
      </div>
    </header>

    <div
      class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto rounded-2xl p-1"
      :class="isDragOver ? 'ring-2 ring-primary/25' : ''"
      role="list"
      :aria-label="`Coluna ${column.nome}`"
      @dragenter="onDragOver"
      @dragover="onDragOver"
      @drop="onDrop"
    >
      <KanbanCard
        v-for="c in cardsOrdenados"
        :key="c.conversa_key"
        :card="c"
        :column-id="column.id"
        :dragging-id="draggingId ?? null"
        :selected="selectedSet.has(c.conversa_key)"
        :force-show-checkbox="props.forceShowCheckboxes === true"
        @card-drag-start="emit('cardDragStart', $event)"
        @card-drag-end="emit('cardDragEnd')"
        @card-open="emit('cardOpen', $event)"
        @card-toggle-selected="emit('cardToggleSelected', $event)"
      />

      <div
        v-if="column.cards.length === 0"
        class="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-outline/30 bg-white/50 p-6 text-center text-xs text-slate-500 dark:border-dark-outline/30 dark:bg-slate-900/20 dark:text-dark-on-surface-variant"
        @dragenter="onDragOver"
        @dragover="onDragOver"
        @drop="onDrop"
      >
        Solte um card aqui
      </div>
    </div>

    <button
      v-if="column.has_more"
      type="button"
      class="mt-3 w-full rounded-xl border border-outline/30 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-dark-outline/30 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:bg-slate-800"
      :disabled="carregandoMais"
      @click="emit('loadMore', column.id)"
    >
      <span v-if="carregandoMais" class="inline-flex items-center justify-center gap-2">
        <span
          class="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent"
          aria-hidden="true"
        />
        Carregando…
      </span>
      <span v-else>Carregar mais</span>
    </button>
    </template>

    <ModalCriarMensagemPronta
      v-model:open="modalMensagemProntaAberto"
      :sequencia-id="sequenciaIdModal"
      @salvo="onMensagemProntaSalva"
    />
  </section>
</template>
