<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import type { KanbanCard as KanbanCardModel, KanbanColumn as KanbanColumnData, KanbanCriarContatoBody, KanbanCriarContatoResponse } from '#shared/types/kanban'
import { normalizarTelefoneContatoParaGravacao } from '#shared/utils/normalizeWhatsappBr'
import BaseButton from '~/components/BaseButton.vue'
import BaseInput from '~/components/BaseInput.vue'
import BaseModal from '~/components/BaseModal.vue'
import KanbanColumn from './KanbanColumn.vue'
import ModalNovaColuna from './ModalNovaColuna.vue'
import InfoContatoKanban from './InfoContatoKanban/InfoContatoKanban.vue'
import FerramentaImportarContato from './importar-contatos/FerramentaImportarContato.vue'
import ModalAlerta from '~/components/ModalAlerta.vue'
import ModalEnvioProdutos from '~/components/ModalEnvioProdutos.vue'
import SelecaoMultiplaBar from '~/components/kanban/SelecaoMultiplaBar.vue'
import SeletorFunilKanban from '~/components/kanban/SeletorFunilKanban.vue'
import { mensagemErroFetch, useCanaisStore } from '~/stores/canais'
import { useKanbanStore } from '~/stores/kanban'
import { useProfileStore } from '~/stores/profile'

type DragState = {
  cardId: string
  fromColumnId: string
} | null

const props = defineProps<{
  workspaceId: number
  funilId: number
}>()

const router = useRouter()
const kanban = useKanbanStore()
const canaisStore = useCanaisStore()
const profile = useProfileStore()
const isAdmin = computed(() => profile.isAdminConfirmado)
const {
  columns,
  reorderingColumnId,
  loadingMoreByColumn,
  busca,
  pending,
  ocultarGrupos,
  filtroCanalId,
} = storeToRefs(kanban)

const { items: canaisItems, listPending: canaisPending, currentCanalId } = storeToRefs(canaisStore)

const buscaInput = ref('')
const alternandoOcultarGrupos = ref(false)
const alternandoFiltroCanal = ref(false)
let buscaTimer: ReturnType<typeof setTimeout> | null = null

const modalNovoContatoAberto = ref(false)
const nomeContato = ref('')
const telefoneContato = ref('')
const colunaSelecionadaId = ref<number | null>(null)
const canalSelecionadoId = ref<number | null>(null)
const criandoContato = ref(false)
const carregandoCanaisModal = ref(false)

const selectedKeys = ref<string[]>([])
const selectedCount = computed(() => selectedKeys.value.length)
const selectionActive = computed(() => selectedCount.value > 0)

/** Modal de progresso enquanto `reorderColumnAdjacent` está em execução. */
const modalReordenandoColunasOpen = computed({
  get: () => reorderingColumnId.value != null,
  set: () => {
    /* fecha só quando a action do Pinia limpa `reorderingColumnId` */
  },
})

function isSelected(key: string): boolean {
  const k = key.trim()
  if (!k) return false
  return selectedKeys.value.includes(k)
}

function toggleSelected(key: string, nextSelected?: boolean) {
  const k = key.trim()
  if (!k) return
  const cur = isSelected(k)
  const next = nextSelected ?? !cur
  if (next === cur) return
  if (next) {
    selectedKeys.value = [...selectedKeys.value, k]
    return
  }
  selectedKeys.value = selectedKeys.value.filter((x) => x !== k)
}

function clearSelection() {
  selectedKeys.value = []
}

const canaisDoWorkspace = computed(() =>
  canaisStore.items.filter((c) => c.id != null && c.id > 0),
)

const lojaAbertaPendingIds = ref<number[]>([])
const agendaPedidoPendingIds = ref<number[]>([])

function isLojaAbertaPending(canalId: number): boolean {
  return lojaAbertaPendingIds.value.includes(canalId)
}

function isAgendaPedidoPending(canalId: number): boolean {
  return agendaPedidoPendingIds.value.includes(canalId)
}

function canalLojaAberta(canal: { loja_aberta?: boolean | null }): boolean {
  return canal.loja_aberta !== false
}

function canalAgendaPedido(canal: { agenda_pedido?: boolean | null }): boolean {
  return canal.agenda_pedido === true
}

async function onToggleLojaAberta(canalId: number, next: boolean) {
  if (!props.workspaceId || isLojaAbertaPending(canalId)) return
  lojaAbertaPendingIds.value = [...lojaAbertaPendingIds.value, canalId]
  try {
    await canaisStore.setLojaAberta({
      workspace_id: props.workspaceId,
      id_canal: canalId,
      loja_aberta: next,
    })
  } catch (err) {
    toast.error(mensagemErroFetch(err, 'Não foi possível atualizar o status da loja.'))
  } finally {
    lojaAbertaPendingIds.value = lojaAbertaPendingIds.value.filter((id) => id !== canalId)
  }
}

async function onToggleAgendaPedido(canalId: number, next: boolean) {
  if (!props.workspaceId || isAgendaPedidoPending(canalId)) return
  agendaPedidoPendingIds.value = [...agendaPedidoPendingIds.value, canalId]
  try {
    await canaisStore.setAgendaPedido({
      workspace_id: props.workspaceId,
      id_canal: canalId,
      agenda_pedido: next,
    })
  } catch (err) {
    toast.error(mensagemErroFetch(err, 'Não foi possível atualizar a agenda de pedido.'))
  } finally {
    agendaPedidoPendingIds.value = agendaPedidoPendingIds.value.filter((id) => id !== canalId)
  }
}

const filtroCanalSelect = computed({
  get: () => (filtroCanalId.value != null ? String(filtroCanalId.value) : ''),
  set: (v: string) => {
    void onFiltroCanalChange(v)
  },
})

onMounted(() => {
  if (props.workspaceId) {
    // force: garante `loja_aberta` após deploy (cache antigo do Pinia)
    void canaisStore.ensureCanaisLoaded(props.workspaceId, { force: true }).catch(() => {})
  }
})

watch(
  () => props.workspaceId,
  (wid) => {
    if (wid) void canaisStore.ensureCanaisLoaded(wid, { force: true }).catch(() => {})
  },
)

watch(
  busca,
  (v) => {
    if (buscaInput.value !== v) buscaInput.value = v
  },
  { immediate: true },
)

function agendarBusca() {
  if (buscaTimer) clearTimeout(buscaTimer)
  buscaTimer = setTimeout(() => {
    buscaTimer = null
    if (!props.workspaceId) return
    void kanban.applyBusca(props.workspaceId, buscaInput.value)
  }, 400)
}

function limparBusca() {
  buscaInput.value = ''
  agendarBusca()
}

async function onOcultarGruposChange(e: Event) {
  if (!props.workspaceId || alternandoOcultarGrupos.value) return
  const checked = (e.target as HTMLInputElement).checked
  alternandoOcultarGrupos.value = true
  try {
    await kanban.setOcultarGrupos(props.workspaceId, checked)
  } finally {
    alternandoOcultarGrupos.value = false
  }
}

async function onFiltroCanalChange(raw: string) {
  if (!props.workspaceId || alternandoFiltroCanal.value) return
  const v = String(raw ?? '').trim()
  const canalId = v ? Number.parseInt(v, 10) : null
  const next =
    canalId != null && Number.isFinite(canalId) && canalId > 0 ? canalId : null
  if (next === filtroCanalId.value) return

  alternandoFiltroCanal.value = true
  try {
    await kanban.setFiltroCanalId(props.workspaceId, next)
  } finally {
    alternandoFiltroCanal.value = false
  }
}

onUnmounted(() => {
  if (buscaTimer) clearTimeout(buscaTimer)
})

const dragging = ref<DragState>(null)
const dragOverColumnId = ref<string | number | null>(null)
const dragOverLixeira = ref(false)

const modalColunaOpen = ref(false)
const modalColunaMode = ref<'create' | 'edit'>('create')
const colunaEmEdicao = ref<KanbanColumnData | null>(null)

const modalExcluirColuna = ref(false)
const colunaParaExcluir = ref<KanbanColumnData | null>(null)
const excluindoColuna = ref(false)

const modalExcluirCard = ref(false)
const cardParaExcluir = ref<string | null>(null)
const excluindoCard = ref(false)

const textoConfirmarExclusaoCard = computed(() => {
  const key = cardParaExcluir.value
  let nome = ''
  if (key) {
    for (const col of columns.value) {
      const card = col.cards.find((c) => c.conversa_key === key)
      if (!card) continue
      nome = card.name?.trim() || card.phone?.trim() || ''
      break
    }
  }
  const quem = nome ? ` "${nome}"` : ''
  return `A conversa${quem} e todas as mensagens serão apagadas permanentemente do banco. Esta ação não poderá ser desfeita.`
})

const ferramentaImportarRef = ref<{ abrirSeletorImportacao: () => void } | null>(null)

function aoClicarImportarContatos() {
  ferramentaImportarRef.value?.abrirSeletorImportacao()
}

const textoConfirmarExclusao = computed(() => {
  const n = colunaParaExcluir.value?.nome?.trim() || 'esta etapa'
  return `Tem certeza que deseja excluir a etapa "${n}"? Esta ação não pode ser desfeita.`
})

const gridStyle = computed(() => {
  const cols = columns.value
  if (cols.length <= 0) {
    return {
      '--kanban-cols-mobile': 'minmax(0, 1fr)',
      '--kanban-cols-desktop': 'minmax(0, 1fr)',
    } as Record<string, string>
  }
  const mobile = cols
    .map((c) => (c.recolhida ? '3rem' : 'minmax(260px, 1fr)'))
    .join(' ')
  const desktop = cols
    .map((c) => (c.recolhida ? '3rem' : 'minmax(0, 1fr)'))
    .join(' ')
  return {
    '--kanban-cols-mobile': mobile,
    '--kanban-cols-desktop': desktop,
  } as Record<string, string>
})

function abrirNovaColuna() {
  modalColunaMode.value = 'create'
  colunaEmEdicao.value = null
  modalColunaOpen.value = true
}

function nomeCanalOpcao(canal: { id: number; nome: string | null }) {
  const n = canal.nome?.trim()
  return n || `Canal #${canal.id}`
}

function canalPadraoId(): number | null {
  const atual = currentCanalId.value
  if (atual != null && canaisItems.value.some((c) => c.id === atual)) return atual
  return canaisItems.value[0]?.id ?? null
}

async function garantirCanaisNoModal() {
  if (!props.workspaceId) return
  carregandoCanaisModal.value = true
  try {
    await canaisStore.ensureCanaisLoaded(props.workspaceId)
    if (
      canalSelecionadoId.value == null ||
      !canaisItems.value.some((c) => c.id === canalSelecionadoId.value)
    ) {
      canalSelecionadoId.value = canalPadraoId()
    }
  } catch (err: unknown) {
    toast.error(mensagemErroFetch(err, 'Não foi possível carregar os canais.'))
  } finally {
    carregandoCanaisModal.value = false
  }
}

async function abrirModalNovoContato() {
  nomeContato.value = ''
  telefoneContato.value = ''
  colunaSelecionadaId.value = null
  canalSelecionadoId.value = canalPadraoId()
  modalNovoContatoAberto.value = true
  await garantirCanaisNoModal()
}

function fecharModalNovoContato() {
  modalNovoContatoAberto.value = false
}

watch(modalNovoContatoAberto, (aberto) => {
  if (!aberto) {
    nomeContato.value = ''
    telefoneContato.value = ''
    colunaSelecionadaId.value = null
    canalSelecionadoId.value = null
    criandoContato.value = false
    carregandoCanaisModal.value = false
  }
})

function validarFormularioNovoContato():
  | { erro: string }
  | { telefone: string; id_canal: number; coluna_id: number } {
  if (!nomeContato.value.trim()) return { erro: 'Informe o nome.' }

  const telefone = normalizarTelefoneContatoParaGravacao(telefoneContato.value)
  if (!telefone) {
    return {
      erro: 'Telefone inválido. Use DDD+número (ex: 11 9xxxx xxxx) ou com DDI 55.',
    }
  }

  if (colunaSelecionadaId.value == null || colunaSelecionadaId.value < 1) {
    return { erro: 'Selecione a coluna.' }
  }

  if (canalSelecionadoId.value == null || canalSelecionadoId.value < 1) {
    return { erro: 'Selecione o canal.' }
  }

  return {
    telefone,
    id_canal: canalSelecionadoId.value,
    coluna_id: colunaSelecionadaId.value,
  }
}

async function criarContato() {
  const validacao = validarFormularioNovoContato()
  if ('erro' in validacao) {
    toast.error(validacao.erro)
    return
  }
  if (!props.workspaceId) {
    toast.error('Workspace não informado.')
    return
  }

  criandoContato.value = true
  try {
    const body: KanbanCriarContatoBody = {
      workspace_id: props.workspaceId,
      nome: nomeContato.value.trim(),
      telefone: validacao.telefone,
      coluna_id: validacao.coluna_id,
      id_canal: validacao.id_canal,
    }
    await $fetch<KanbanCriarContatoResponse>('/api/kanban/contato', {
      method: 'POST',
      body,
    })
    fecharModalNovoContato()
    await kanban.refetchCurrentBoard(props.workspaceId)
    toast.success('Contato criado.')
  } catch (err: unknown) {
    toast.error(mensagemErroFetch(err, 'Não foi possível criar o contato.'))
  } finally {
    criandoContato.value = false
  }
}

function irDisparoEmMassa() {
  if (!props.workspaceId) return
  void router.push(`/workspaces/${props.workspaceId}/disparo-em-massa`)
}

function onColumnEdit(col: KanbanColumnData) {
  modalColunaMode.value = 'edit'
  colunaEmEdicao.value = col
  modalColunaOpen.value = true
}

function onColumnDelete(col: KanbanColumnData) {
  const total = col.total_cards ?? col.cards.length
  if (total > 0) {
    toast.warning('Mova os cards para outra etapa antes de excluir.', { duration: 6000 })
    return
  }
  colunaParaExcluir.value = col
  modalExcluirColuna.value = true
}

function onLoadMore(colunaId: number) {
  if (!props.workspaceId) return
  void kanban.loadMoreCards({ workspaceId: props.workspaceId, colunaId })
}

function onColumnReorder(payload: {
  columnId: number
  direcao: 'esquerda' | 'direita'
}) {
  if (!props.workspaceId) return
  void kanban.reorderColumnAdjacent({
    workspaceId: props.workspaceId,
    colunaId: payload.columnId,
    direcao: payload.direcao,
  })
}

async function confirmarExcluirColuna() {
  const c = colunaParaExcluir.value
  if (!c || !props.workspaceId) {
    modalExcluirColuna.value = false
    return
  }
  excluindoColuna.value = true
  try {
    const ok = await kanban.deleteColumn({
      workspaceId: props.workspaceId,
      colunaId: c.id,
    })
    if (ok) {
      modalExcluirColuna.value = false
      colunaParaExcluir.value = null
    }
  } finally {
    excluindoColuna.value = false
  }
}

function moveCard(fromColumnId: string, cardId: string, toColumnId: string) {
  if (!fromColumnId || !toColumnId || !cardId) return
  if (fromColumnId === toColumnId) return
  if (!props.workspaceId) return

  void kanban.moveCard({
    workspaceId: props.workspaceId,
    conversaKey: cardId,
    fromColumnId,
    toColumnId,
  })
}

function onCardDragStart(payload: { cardId: string; fromColumnId: string }) {
  dragging.value = payload
  dragOverLixeira.value = false
}

function onCardDragEnd() {
  dragging.value = null
  dragOverColumnId.value = null
  dragOverLixeira.value = false
}

function parseRaw(raw: string): { fromColumnId: string; cardId: string } | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  const [fromColumnId, cardId] = s.split('::')
  if (!fromColumnId || !cardId) return null
  return { fromColumnId, cardId }
}

function onDrop(payload: { toColumnId: string | number; raw: string }) {
  if (dragOverLixeira.value) return
  const parsed = parseRaw(payload.raw)
  const state = dragging.value

  const fromColumnId = state?.fromColumnId ?? parsed?.fromColumnId ?? ''
  const cardId = state?.cardId ?? parsed?.cardId ?? ''

  const toId = String(payload.toColumnId)
  moveCard(fromColumnId, cardId, toId)
  onCardDragEnd()
}

function onLixeiraDragOver(e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  dragOverLixeira.value = true
  dragOverColumnId.value = null
}

function onLixeiraDragLeave(e: DragEvent) {
  e.preventDefault()
  const related = e.relatedTarget as Node | null
  const current = e.currentTarget as HTMLElement | null
  if (current && related && current.contains(related)) return
  dragOverLixeira.value = false
}

function onLixeiraDrop(e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()
  const raw = e.dataTransfer?.getData('text/plain') ?? ''
  const parsed = parseRaw(raw)
  const cardId = dragging.value?.cardId ?? parsed?.cardId ?? ''
  dragOverLixeira.value = false
  onCardDragEnd()
  if (!cardId) return
  cardParaExcluir.value = cardId
  modalExcluirCard.value = true
}

async function confirmarExcluirCard() {
  const key = cardParaExcluir.value
  if (!key) {
    modalExcluirCard.value = false
    return
  }
  excluindoCard.value = true
  try {
    const ok = await kanban.deleteCard(key)
    if (ok) {
      modalExcluirCard.value = false
      cardParaExcluir.value = null
    }
  } finally {
    excluindoCard.value = false
  }
}

function findCardNoPinia(conversaKey: string): KanbanCardModel | null {
  const key = conversaKey.trim()
  if (!key) return null
  for (const col of columns.value) {
    const card = col.cards.find((c) => c.conversa_key === key)
    if (card) return card
  }
  return null
}

async function onCardOpen(card: KanbanCardModel) {
  const fromStore = findCardNoPinia(card.conversa_key) ?? card
  const conversaKey = fromStore.conversa_key?.trim()
  const canalId = fromStore.id_canal

  if (!conversaKey) return
  if (!props.workspaceId) {
    toast.error('Workspace não informado.')
    return
  }
  if (canalId == null || !Number.isFinite(canalId) || canalId < 1) {
    toast.error('Esta conversa não tem canal vinculado.')
    return
  }

  const kanbanStore = useKanbanStore()
  kanbanStore.closeInfoContatoConversa()

  const conversasStore = useConversasStore()
  await abrirConversaNoChat(props.workspaceId, Math.trunc(canalId), conversaKey)
  await conversasStore.aplicarContextoAoAbrirDoKanban({
    conversaKey,
    colunaId: fromStore.coluna_id,
    funilId: props.funilId,
    isGroup: fromStore.is_group,
    conversaAberta: fromStore.conversa_aberta,
  })
}

function onCardToggleSelected(payload: { conversa_key: string; nextSelected: boolean }) {
  toggleSelected(payload.conversa_key, payload.nextSelected)
}

function onColumnToggleSelectAll(payload: { keys: string[]; nextSelected: boolean }) {
  for (const key of payload.keys) {
    toggleSelected(key, payload.nextSelected)
  }
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div class="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <SeletorFunilKanban :workspace-id="workspaceId" />
        <p class="mt-1 text-sm text-slate-600 dark:text-dark-on-surface-variant">
          Arraste conversas entre as etapas do funil.
        </p>
      </div>
      <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
        <div class="relative w-full min-w-[12rem] sm:w-64">
          <span
            class="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2 text-[20px] text-slate-400 dark:text-slate-500"
            aria-hidden="true"
          >
            search
          </span>
          <BaseInput
            v-model="buscaInput"
            type="search"
            placeholder="Buscar por nome ou telefone…"
            autocomplete="off"
            input-class="!rounded-xl !py-2 !pl-10 !pr-9 text-sm"
            @update:model-value="agendarBusca"
          />
          <button
            v-if="buscaInput.trim()"
            type="button"
            class="absolute right-2 top-1/2 z-[1] -translate-y-1/2 rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Limpar busca"
            @click="limparBusca"
          >
            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">close</span>
          </button>
          <span
            v-if="pending && busca.trim() && !buscaInput.trim()"
            class="pointer-events-none absolute right-2 top-1/2 z-[1] -translate-y-1/2"
            aria-hidden="true"
          >
            <span class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </span>
        </div>
        <label
          class="inline-flex min-w-[11rem] flex-col gap-0.5 text-xs font-medium text-slate-600 dark:text-slate-300"
        >
          <span class="sr-only">Filtrar por canal</span>
          <select
            v-model="filtroCanalSelect"
            class="h-[42px] w-full min-w-[11rem] rounded-xl border border-outline/40 bg-white px-3 text-sm font-medium text-slate-800 shadow-sm outline-none transition-colors focus:border-primary dark:border-dark-outline/40 dark:bg-dark-surface-container-low dark:text-dark-on-surface"
            :disabled="alternandoFiltroCanal || pending"
            aria-label="Filtrar por canal"
          >
            <option value="">Todos os canais</option>
            <option
              v-for="canal in canaisDoWorkspace"
              :key="canal.id"
              :value="String(canal.id)"
            >
              {{ canal.nome?.trim() || `Canal #${canal.id}` }}
            </option>
          </select>
        </label>
        <label
          class="inline-flex cursor-pointer select-none items-center gap-2 rounded-xl border border-outline/40 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm transition-colors hover:bg-slate-50 dark:border-dark-outline/40 dark:bg-dark-surface-container-low dark:text-dark-on-surface dark:hover:bg-dark-surface-container"
          :class="alternandoOcultarGrupos ? 'pointer-events-none opacity-60' : ''"
        >
          <input
            type="checkbox"
            class="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary dark:border-slate-600"
            :checked="ocultarGrupos"
            :disabled="alternandoOcultarGrupos"
            @change="onOcultarGruposChange"
          />
          <span
            v-if="alternandoOcultarGrupos"
            class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"
            aria-hidden="true"
          />
          <span
            v-else
            class="material-symbols-outlined text-[18px] text-slate-500 dark:text-slate-400"
            aria-hidden="true"
          >
            group_off
          </span>
          Ocultar grupos
        </label>
        <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-xl border border-outline/40 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 dark:border-dark-outline/40 dark:bg-dark-surface-container-low dark:text-dark-on-surface dark:hover:bg-dark-surface-container"
          @click="abrirModalNovoContato"
        >
          <span class="material-symbols-outlined text-[18px]" aria-hidden="true">person_add</span>
          Novo contato
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-xl border border-outline/40 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 dark:border-dark-outline/40 dark:bg-dark-surface-container-low dark:text-dark-on-surface dark:hover:bg-dark-surface-container"
          @click="aoClicarImportarContatos"
        >
          <span class="material-symbols-outlined text-[18px]" aria-hidden="true">file_upload</span>
          Importar contatos
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-xl border border-outline/40 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 dark:border-dark-outline/40 dark:bg-dark-surface-container-low dark:text-dark-on-surface dark:hover:bg-dark-surface-container"
          @click="irDisparoEmMassa"
        >
          <span class="material-symbols-outlined text-[18px]" aria-hidden="true">send</span>
          Disparo em massa
        </button>
        <button
          v-if="isAdmin"
          type="button"
          class="inline-flex items-center gap-2 rounded-xl border border-outline/40 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 dark:border-dark-outline/40 dark:bg-dark-surface-container-low dark:text-dark-on-surface dark:hover:bg-dark-surface-container"
          @click="abrirNovaColuna"
        >
          <span class="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
          Nova coluna
        </button>
        </div>
      </div>
    </div>

    <div
      v-if="canaisDoWorkspace.length > 0"
      class="mb-4 flex flex-wrap items-center gap-2"
    >
      <span
        class="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
      >
        Loja
      </span>
      <div
        v-for="canal in canaisDoWorkspace"
        :key="`loja-aberta-${canal.id}`"
        class="inline-flex max-w-full flex-wrap items-center gap-2 rounded-xl border border-outline/40 bg-white px-3 py-1.5 shadow-sm dark:border-dark-outline/40 dark:bg-dark-surface-container-low"
        :class="
          isLojaAbertaPending(canal.id) || isAgendaPedidoPending(canal.id) ? 'opacity-70' : ''
        "
      >
        <span
          class="max-w-[9rem] truncate text-sm font-medium text-slate-800 dark:text-dark-on-surface sm:max-w-[12rem]"
          :title="canal.nome?.trim() || `Canal #${canal.id}`"
        >
          {{ canal.nome?.trim() || `Canal #${canal.id}` }}
        </span>
        <span
          class="hidden text-[11px] font-medium sm:inline"
          :class="
            canalLojaAberta(canal)
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-slate-400 dark:text-slate-500'
          "
        >
          {{ canalLojaAberta(canal) ? 'Aberta' : 'Fechada' }}
        </span>
        <button
          type="button"
          role="switch"
          :aria-checked="canalLojaAberta(canal)"
          :aria-label="
            canalLojaAberta(canal)
              ? `Fechar loja ${canal.nome?.trim() || canal.id}`
              : `Abrir loja ${canal.nome?.trim() || canal.id}`
          "
          :disabled="isLojaAbertaPending(canal.id)"
          class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 disabled:cursor-wait"
          :class="
            canalLojaAberta(canal)
              ? 'bg-emerald-500 dark:bg-emerald-400'
              : 'bg-outline/40 dark:bg-dark-outline/50'
          "
          @click="onToggleLojaAberta(canal.id, !canalLojaAberta(canal))"
        >
          <span
            class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
            :class="canalLojaAberta(canal) ? 'translate-x-4' : 'translate-x-0.5'"
          />
        </button>

        <template v-if="!canalLojaAberta(canal)">
          <span
            class="hidden h-4 w-px bg-outline/40 sm:inline-block dark:bg-dark-outline/40"
            aria-hidden="true"
          />
          <span class="text-[11px] font-medium text-slate-600 dark:text-slate-300">
            Agenda pedido
          </span>
          <button
            type="button"
            role="switch"
            :aria-checked="canalAgendaPedido(canal)"
            :aria-label="
              canalAgendaPedido(canal)
                ? `Desativar agenda de pedido ${canal.nome?.trim() || canal.id}`
                : `Ativar agenda de pedido ${canal.nome?.trim() || canal.id}`
            "
            :disabled="isAgendaPedidoPending(canal.id)"
            class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 disabled:cursor-wait"
            :class="
              canalAgendaPedido(canal)
                ? 'bg-amber-500 dark:bg-amber-400'
                : 'bg-outline/40 dark:bg-dark-outline/50'
            "
            @click="onToggleAgendaPedido(canal.id, !canalAgendaPedido(canal))"
          >
            <span
              class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
              :class="canalAgendaPedido(canal) ? 'translate-x-4' : 'translate-x-0.5'"
            />
          </button>
        </template>
      </div>
    </div>

    <BaseModal
      v-model:open="modalNovoContatoAberto"
      title="Novo contato"
      :show-close="!criandoContato"
      panel-class="w-full max-w-md"
    >
      <div class="space-y-4">
        <div>
          <label
            class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-dark-on-surface"
            for="kanban-novo-contato-nome"
          >
            Nome
          </label>
          <BaseInput
            id="kanban-novo-contato-nome"
            v-model="nomeContato"
            name="kanban-novo-contato-nome"
            placeholder="Nome do contato"
            autocomplete="name"
            :disabled="criandoContato"
          />
        </div>

        <div>
          <label
            class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-dark-on-surface"
            for="kanban-novo-contato-telefone"
          >
            Telefone
          </label>
          <BaseInput
            id="kanban-novo-contato-telefone"
            v-model="telefoneContato"
            name="kanban-novo-contato-telefone"
            type="tel"
            placeholder="DDD + número"
            autocomplete="tel"
            :disabled="criandoContato"
          />
        </div>

        <div>
          <label
            class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-dark-on-surface"
            for="kanban-novo-contato-canal"
          >
            Canal
          </label>
          <select
            id="kanban-novo-contato-canal"
            v-model.number="canalSelecionadoId"
            class="w-full rounded-xl border border-outline/45 bg-surface-container-lowest/90 px-3.5 py-2.5 text-sm font-medium text-on-surface shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:opacity-60 dark:border-dark-outline/45 dark:bg-dark-surface-container-low/90 dark:text-dark-on-surface"
            :disabled="criandoContato || carregandoCanaisModal || canaisPending"
          >
            <option v-if="canaisItems.length === 0" :value="null" disabled>
              {{ carregandoCanaisModal || canaisPending ? 'Carregando canais…' : 'Nenhum canal disponível' }}
            </option>
            <option v-for="canal in canaisItems" :key="canal.id" :value="canal.id">
              {{ nomeCanalOpcao(canal) }}
            </option>
          </select>
        </div>

        <div>
          <label
            class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-dark-on-surface"
            for="kanban-novo-contato-coluna"
          >
            Coluna
          </label>
          <select
            id="kanban-novo-contato-coluna"
            v-model="colunaSelecionadaId"
            class="w-full rounded-xl border border-outline/45 bg-surface-container-lowest/90 px-3.5 py-2.5 text-sm font-medium text-on-surface shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-dark-outline/45 dark:bg-dark-surface-container-low/90 dark:text-dark-on-surface"
            :disabled="criandoContato"
          >
            <option :value="null">Selecione a coluna</option>
            <option v-for="col in columns" :key="col.id" :value="col.id">
              {{ col.nome?.trim() || `Coluna #${col.id}` }}
            </option>
          </select>
        </div>
      </div>

      <template #footer>
        <BaseButton
          variant="secondary"
          size="sm"
          :block="false"
          :disabled="criandoContato"
          @click="fecharModalNovoContato"
        >
          Cancelar
        </BaseButton>
        <BaseButton
          variant="primary"
          size="sm"
          :block="false"
          :loading="criandoContato"
          :disabled="criandoContato || carregandoCanaisModal || canaisPending || canaisItems.length === 0"
          @click="criarContato"
        >
          Criar
        </BaseButton>
      </template>
    </BaseModal>

    <ModalNovaColuna
      v-model:open="modalColunaOpen"
      :workspace-id="workspaceId"
      :mode="modalColunaMode"
      :column="colunaEmEdicao"
    />

    <ModalAlerta
      v-model:open="modalExcluirColuna"
      title="Excluir etapa"
      :texto="textoConfirmarExclusao"
      variante="perigo"
      texto-confirmar="Excluir"
      :confirmar-desabilitado="excluindoColuna"
      @confirmar="confirmarExcluirColuna"
    />

    <ModalAlerta
      v-model:open="modalExcluirCard"
      title="Excluir conversa?"
      :texto="textoConfirmarExclusaoCard"
      variante="perigo"
      texto-confirmar="Excluir"
      texto-cancelar="Cancelar"
      :confirmar-desabilitado="excluindoCard"
      :cancelar-desabilitado="excluindoCard"
      @confirmar="confirmarExcluirCard"
    />

    <InfoContatoKanban />

    <SelecaoMultiplaBar
      v-if="selectedCount > 0"
      :count="selectedCount"
      :workspace-id="workspaceId"
      :funil-id="funilId"
      :selected-keys="selectedKeys"
      @limpar="clearSelection"
      @concluido="clearSelection"
    />

    <FerramentaImportarContato
      ref="ferramentaImportarRef"
      :workspace-id="workspaceId"
    />

    <div
      v-if="columns.length > 0"
      class="kanban-board-cols grid min-h-0 flex-1 gap-5 overflow-x-auto pb-2 md:overflow-x-hidden"
      :style="gridStyle"
    >
      <KanbanColumn
        v-for="(c, i) in columns"
        :key="c.id"
        :workspace-id="workspaceId"
        :column="c"
        :pode-mover-esquerda="i > 0"
        :pode-mover-direita="i < columns.length - 1"
        :reordenando="reorderingColumnId === c.id"
        :carregando-mais="!!loadingMoreByColumn[c.id]"
        :dragging-id="dragging?.cardId ?? null"
        :drag-over-column-id="dragOverColumnId"
        :selected-keys="selectedKeys"
        :force-show-checkboxes="selectionActive"
        @card-drag-start="onCardDragStart"
        @card-drag-end="onCardDragEnd"
        @column-drag-over="dragOverColumnId = $event.toColumnId"
        @column-drag-leave="dragOverColumnId = null"
        @column-drop="onDrop"
        @column-edit="onColumnEdit"
        @column-delete="onColumnDelete"
        @column-reorder="onColumnReorder"
        @load-more="onLoadMore"
        @card-open="onCardOpen"
        @card-toggle-selected="onCardToggleSelected"
        @column-toggle-select-all="onColumnToggleSelectAll"
      />
    </div>

    <div
      v-else
      class="flex flex-1 flex-col items-center justify-center rounded-3xl border border-dashed border-outline/40 bg-white/40 p-10 text-center dark:border-dark-outline/40 dark:bg-dark-surface-container-low/40"
    >
      <p class="text-sm font-medium text-slate-700 dark:text-dark-on-surface">
        Nenhuma coluna neste funil.
      </p>
      <p class="mt-2 max-w-md text-xs text-slate-500 dark:text-dark-on-surface-variant">
        Configure colunas em `funil_workspace_colunas` ou verifique se o workspace tem funil criado.
      </p>
    </div>

    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 translate-y-3"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-3"
    >
      <div
        v-if="dragging"
        class="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-6"
      >
        <div
          class="pointer-events-auto flex min-h-[4.5rem] w-full max-w-md items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-4 shadow-lg backdrop-blur-sm transition-colors"
          :class="
            dragOverLixeira
              ? 'border-rose-500 bg-rose-100 text-rose-800 dark:border-rose-400 dark:bg-rose-950/80 dark:text-rose-100'
              : 'border-rose-300 bg-white/95 text-rose-700 dark:border-rose-800 dark:bg-dark-surface-container-low/95 dark:text-rose-200'
          "
          role="button"
          aria-label="Solte aqui para excluir a conversa"
          @dragenter.prevent="onLixeiraDragOver"
          @dragover.prevent="onLixeiraDragOver"
          @dragleave="onLixeiraDragLeave"
          @drop.prevent="onLixeiraDrop"
        >
          <span
            class="material-symbols-outlined text-[28px]"
            :class="dragOverLixeira ? 'scale-110' : ''"
            aria-hidden="true"
          >
            delete
          </span>
          <div class="text-left">
            <p class="text-sm font-semibold">
              {{ dragOverLixeira ? 'Solte para excluir' : 'Arraste para a lixeira' }}
            </p>
            <p class="text-xs opacity-80">
              A exclusão é permanente.
            </p>
          </div>
        </div>
      </div>
    </Transition>

    <ModalEnvioProdutos
      v-model:open="modalReordenandoColunasOpen"
      title="Trocando a ordem das colunas…"
      :total="1"
      :enviados="0"
      :pode-cancelar="false"
    >
      <template #extra>
        <p class="text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
          Aguarde enquanto a ordem das colunas é atualizada…
        </p>
      </template>
    </ModalEnvioProdutos>
  </div>
</template>

<style scoped>
/* Mobile: colunas abertas com min 260px; recolhidas estreitas. */
.kanban-board-cols {
  grid-template-columns: var(--kanban-cols-mobile);
}

/* Desktop: abertas dividem a tela; recolhidas ficam em 3rem. */
@media (min-width: 768px) {
  .kanban-board-cols {
    grid-template-columns: var(--kanban-cols-desktop);
  }
}
</style>
