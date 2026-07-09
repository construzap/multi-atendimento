<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import type {
  KanbanCard as KanbanCardModel,
  KanbanColumn,
  KanbanCriarContatoBody,
  KanbanCriarContatoResponse,
} from '#shared/types/kanban'
import { normalizarTelefoneContatoParaGravacao } from '#shared/utils/normalizeWhatsappBr'
import BaseButton from '~/components/BaseButton.vue'
import BaseInput from '~/components/BaseInput.vue'
import BaseModal from '~/components/BaseModal.vue'
import BaseDropdown from '~/components/ui/BaseDropdown.vue'
import { mensagemErroFetch, useCanaisStore } from '~/stores/canais'
import { useKanbanStore } from '~/stores/kanban'
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
}>()

const kanban = useKanbanStore()
const canaisStore = useCanaisStore()
const { columns } = storeToRefs(kanban)
const { items: canaisItems, listPending: canaisPending, currentCanalId } = storeToRefs(canaisStore)

/** Coluna atual no Pinia (fonte de verdade do board). */
const colunaNoStore = computed(() =>
  columns.value.find((c) => c.id === props.column.id) ?? null,
)

const colunaIdExibicao = computed(() => colunaNoStore.value?.id ?? props.column.id)

const modalNovoContatoAberto = ref(false)
const nomeContato = ref('')
const telefoneContato = ref('')
const colunaSelecionadaId = ref<number | null>(null)
const canalSelecionadoId = ref<number | null>(null)
const criandoContato = ref(false)
const carregandoCanaisModal = ref(false)

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
  colunaSelecionadaId.value = props.column.id
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
    await kanban.fetchBoard(props.workspaceId)
    toast.success('Contato criado.')
  } catch (err: unknown) {
    toast.error(mensagemErroFetch(err, 'Não foi possível criar o contato.'))
  } finally {
    criandoContato.value = false
  }
}

function onEditar(close: () => void) {
  close()
  emit('columnEdit', props.column)
}

function onExcluir(close: () => void) {
  close()
  emit('columnDelete', props.column)
}

function emitReorder(direcao: 'esquerda' | 'direita') {
  if (props.reordenando) return
  emit('columnReorder', { columnId: props.column.id, direcao })
}

const dotStyle = computed(() => {
  const c = props.column.cor?.trim()
  if (c) return { backgroundColor: c }
  return { backgroundColor: 'rgb(148 163 184)' }
})

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

/** Mais recente primeiro; desempate por `conversa_key` (igual à API). */
const cardsOrdenados = computed(() =>
  [...props.column.cards].sort((a, b) => {
    const ta = a.updated_at ? new Date(a.updated_at).getTime() : 0
    const tb = b.updated_at ? new Date(b.updated_at).getTime() : 0
    if (tb !== ta) return tb - ta
    return a.conversa_key.localeCompare(b.conversa_key)
  }),
)

const selectedSet = computed(() => new Set((props.selectedKeys ?? []).map((k) => String(k).trim()).filter(Boolean)))

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
    class="flex h-full min-h-0 flex-col rounded-3xl p-4 dark:bg-slate-900/30"
    :style="columnSurfaceStyle"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <header class="mb-4 flex items-start justify-between gap-2">
      <div class="min-w-0 flex-1">
        <div class="flex items-start gap-2">
          <span
            class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
            :style="dotStyle"
            aria-hidden="true"
          />
          <div class="min-w-0 flex-1">
            <h2
              class="break-normal font-headline text-sm font-bold leading-snug text-slate-900 dark:text-dark-on-surface"
              lang="pt-BR"
            >
              {{ column.nome }}
            </h2>
            <p class="mt-0.5 text-[11px] font-medium tabular-nums text-slate-500 dark:text-slate-400">
              ID {{ colunaIdExibicao }}
            </p>
          </div>
        </div>
      </div>

      <div class="flex shrink-0 items-start gap-1 pt-0.5">
        <div
          v-if="podeMoverEsquerda || podeMoverDireita"
          class="flex shrink-0 items-center gap-0.5"
          @click.stop
          @mousedown.stop
        >
          <button
            v-if="podeMoverEsquerda"
            type="button"
            class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-white/70 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800/80"
            :disabled="reordenando"
            aria-label="Mover etapa para a esquerda"
            @click="emitReorder('esquerda')"
          >
            <span class="material-symbols-outlined text-[20px]" aria-hidden="true">chevron_left</span>
          </button>
          <button
            v-if="podeMoverDireita"
            type="button"
            class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-white/70 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800/80"
            :disabled="reordenando"
            aria-label="Mover etapa para a direita"
            @click="emitReorder('direita')"
          >
            <span class="material-symbols-outlined text-[20px]" aria-hidden="true">chevron_right</span>
          </button>
        </div>

        <span
          class="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-bold text-slate-700 shadow-sm dark:bg-slate-800/70 dark:text-slate-200"
        >
          {{ column.total_cards ?? column.cards.length }}
        </span>

        <button
          type="button"
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-white/60 dark:text-slate-400 dark:hover:bg-slate-800/80"
          :aria-label="`Adicionar em ${column.nome}`"
          @click.stop="abrirModalNovoContato"
        >
          <span class="material-symbols-outlined text-[22px]" aria-hidden="true">add</span>
        </button>

        <div class="shrink-0" @click.stop @mousedown.stop>
          <BaseDropdown
            title="Etapa"
            align="right"
            side="bottom"
            panel-class="w-52 min-w-[12rem] max-w-[calc(100vw-2rem)]"
          >
            <template #trigger>
              <span
                class="flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-white/60 dark:hover:bg-slate-800/80"
              >
                <span
                  class="material-symbols-outlined text-[22px] text-slate-600 dark:text-slate-400"
                  aria-hidden="true"
                >
                  settings
                </span>
                <span class="sr-only">Configurações da etapa</span>
              </span>
            </template>

            <template #default="{ close }">
              <button
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
          </BaseDropdown>
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
            v-model.number="colunaSelecionadaId"
            class="w-full rounded-xl border border-outline/45 bg-surface-container-lowest/90 px-3.5 py-2.5 text-sm font-medium text-on-surface shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] transition-all focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-dark-outline/45 dark:bg-dark-surface-container-low/90 dark:text-dark-on-surface"
            :disabled="criandoContato"
          >
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
  </section>
</template>
