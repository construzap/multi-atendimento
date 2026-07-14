<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import type { KanbanFunilColunaResumo, KanbanFunilItem } from '#shared/types/kanban'
import { useKanbanStore } from '~/stores/kanban'
import { useConversasFiltros } from '~/composables/useConversasFiltros'
import { useWorkspacesStore } from '~/stores/workspaces'

const route = useRoute()
const kanbanStore = useKanbanStore()
const { conversasStore, filtroKanbanFunilId, filtroKanbanColunaId, temFiltroKanbanAtivo } =
  useConversasFiltros()
const workspacesStore = useWorkspacesStore()
const { funis, funisPending } = storeToRefs(kanbanStore)

const painelAberto = ref(false)

const scroller = ref<HTMLElement | null>(null)
const arrastando = ref(false)
const arrastou = ref(false)
const posInicioX = ref(0)
const scrollInicio = ref(0)

function parseWorkspaceId(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw ?? ''), 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

const workspaceId = computed(() => {
  const fromStore = parseWorkspaceId(workspacesStore.currentWorkspaceId)
  if (fromStore) return fromStore
  return parseWorkspaceId(route.params.id)
})

const funilSelecionado = computed(() => {
  if (filtroKanbanFunilId.value == null) return null
  return funis.value.find((f) => f.id === filtroKanbanFunilId.value) ?? null
})

const colunasDoFunil = computed(() => {
  const cols = funilSelecionado.value?.columns ?? []
  return [...cols].sort((a, b) => a.ordem - b.ordem)
})

const resumoFiltro = computed(() => {
  const funil = funilSelecionado.value
  const coluna = colunasDoFunil.value.find((c) => c.id === filtroKanbanColunaId.value)
  if (funil && coluna) return `${funil.nome} · ${coluna.nome}`
  if (funil) return funil.nome
  return ''
})

function restaurarFunilDaColunaAtiva() {
  const colId = filtroKanbanColunaId.value
  if (colId == null) return

  for (const funil of funis.value) {
    const coluna = funil.columns?.find((c) => c.id === colId)
    if (coluna) {
      conversasStore.setFiltroKanbanFunil(funil.id)
      return
    }
  }
}

const mostrandoColunas = computed(() => filtroKanbanFunilId.value != null)

async function garantirFunisCarregados() {
  const wsId = workspaceId.value
  if (!wsId) return
  try {
    await kanbanStore.ensureFunisLoaded(wsId)
    restaurarFunilDaColunaAtiva()
  } catch {
    // erro em kanbanStore.funisError
  }
}

function abrirPainel() {
  painelAberto.value = true
  void garantirFunisCarregados()
}

function fecharPainel() {
  painelAberto.value = false
}

function selecionarFunil(funil: KanbanFunilItem) {
  if (arrastou.value) return
  if (filtroKanbanFunilId.value === funil.id) return
  conversasStore.setFiltroKanbanFunil(funil.id)
}

function selecionarColuna(coluna: KanbanFunilColunaResumo) {
  if (arrastou.value) return
  if (filtroKanbanColunaId.value === coluna.id) return
  void conversasStore.aplicarFiltroColuna(coluna.id)
}

async function voltarParaFunis() {
  if (filtroKanbanColunaId.value != null) {
    await conversasStore.limparFiltroKanban()
    return
  }
  conversasStore.setFiltroKanbanFunil(null)
}

async function limparFiltro() {
  await conversasStore.limparFiltroKanban()
}

function corDot(cor: string | null | undefined): string {
  const c = cor?.trim()
  return c || '#94a3b8'
}

function onMouseDown(e: MouseEvent) {
  const el = scroller.value
  if (!el || e.button !== 0) return

  arrastando.value = true
  arrastou.value = false
  posInicioX.value = e.pageX
  scrollInicio.value = el.scrollLeft
  el.classList.add('is-dragging')

  function onMove(ev: MouseEvent) {
    if (!arrastando.value || !scroller.value) return
    const delta = ev.pageX - posInicioX.value
    if (Math.abs(delta) > 4) arrastou.value = true
    ev.preventDefault()
    scroller.value.scrollLeft = scrollInicio.value - delta
  }

  function onUp() {
    const arrastouAntes = arrastou.value
    arrastando.value = false
    scroller.value?.classList.remove('is-dragging')
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
    window.setTimeout(() => {
      arrastou.value = false
    }, arrastouAntes ? 80 : 0)
  }

  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

watch(
  workspaceId,
  (wsId) => {
    painelAberto.value = false
    void conversasStore.limparFiltroKanban()
    if (wsId) void garantirFunisCarregados()
  },
  { immediate: true },
)

watch(filtroKanbanColunaId, (colId) => {
  if (colId == null) return
  if (filtroKanbanFunilId.value != null) return
  restaurarFunilDaColunaAtiva()
})
</script>

<template>
  <div class="border-b border-slate-200/80 dark:border-slate-700/80">
    <!-- Fechado -->
    <button
      v-if="!painelAberto"
      type="button"
      class="flex w-full cursor-pointer items-center justify-center gap-1.5 px-4 py-2.5 text-center transition-colors hover:bg-slate-200/40 dark:hover:bg-slate-800/40"
      @click="abrirPainel"
    >
      <span class="material-symbols-outlined text-[16px] text-slate-500 dark:text-slate-400" aria-hidden="true">
        filter_alt
      </span>
      <span class="text-[11px] font-medium text-slate-500 dark:text-slate-400">
        Filtrar no kanban
      </span>
      <span
        v-if="resumoFiltro"
        class="max-w-[10rem] truncate rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary dark:bg-primary/20"
      >
        {{ resumoFiltro }}
      </span>
    </button>

    <!-- Aberto: funis OU colunas (compacto) -->
    <div
      v-else
      class="flex min-h-[2.75rem] items-center gap-1 px-2 py-2.5"
    >
      <button
        v-if="mostrandoColunas"
        type="button"
        class="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-500 transition-colors hover:bg-slate-200/70 dark:text-slate-400 dark:hover:bg-slate-800"
        aria-label="Voltar para funis"
        @click="voltarParaFunis"
      >
        <span class="material-symbols-outlined text-[16px]" aria-hidden="true">arrow_back</span>
      </button>

      <p
        v-if="funisPending && funis.length === 0"
        class="min-w-0 flex-1 truncate px-2 text-center text-[11px] italic text-slate-500 dark:text-slate-400"
      >
        Carregando…
      </p>

      <p
        v-else-if="!mostrandoColunas && !funisPending && funis.length === 0"
        class="min-w-0 flex-1 truncate px-2 text-center text-[11px] text-slate-500 dark:text-slate-400"
      >
        Nenhum funil
      </p>

      <p
        v-else-if="mostrandoColunas && colunasDoFunil.length === 0"
        class="min-w-0 flex-1 truncate px-2 text-center text-[11px] text-slate-500 dark:text-slate-400"
      >
        Nenhuma coluna
      </p>

      <div
        v-else
        ref="scroller"
        class="filtro-kanban-scroll flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto"
        @mousedown="onMouseDown"
      >
        <template v-if="!mostrandoColunas">
          <button
            v-for="funil in funis"
            :key="`f-${funil.id}`"
            type="button"
            class="filtro-kanban-chip shrink-0 rounded-lg border px-2 py-1 text-[10px] font-semibold transition-colors"
            :class="
              filtroKanbanFunilId === funil.id
                ? 'border-primary/50 bg-primary/10 text-primary dark:bg-primary/15'
                : 'border-slate-200/80 bg-white text-slate-700 hover:border-primary/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200'
            "
            @click.stop="selecionarFunil(funil)"
          >
            {{ funil.nome }}
          </button>
        </template>

        <template v-else>
          <button
            v-for="coluna in colunasDoFunil"
            :key="`c-${coluna.id}`"
            type="button"
            class="filtro-kanban-chip flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-semibold transition-colors"
            :class="
              filtroKanbanColunaId === coluna.id
                ? 'border-primary/50 bg-primary/10 text-primary dark:bg-primary/15'
                : 'border-slate-200/80 bg-white text-slate-700 hover:border-primary/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200'
            "
            @click.stop="selecionarColuna(coluna)"
          >
            <span
              class="h-1.5 w-1.5 shrink-0 rounded-full"
              :style="{ backgroundColor: corDot(coluna.cor) }"
              aria-hidden="true"
            />
            {{ coluna.nome }}
          </button>
        </template>
      </div>

      <div class="flex shrink-0 items-center gap-0.5">
        <button
          v-if="temFiltroKanbanAtivo"
          type="button"
          class="rounded px-1.5 py-0.5 text-[10px] font-medium text-slate-500 transition-colors hover:bg-slate-200/70 dark:text-slate-400 dark:hover:bg-slate-800"
          @click="limparFiltro"
        >
          Limpar
        </button>
        <button
          type="button"
          class="flex h-6 w-6 items-center justify-center rounded text-slate-500 transition-colors hover:bg-slate-200/70 dark:text-slate-400 dark:hover:bg-slate-800"
          aria-label="Fechar filtro"
          @click="fecharPainel"
        >
          <span class="material-symbols-outlined text-[16px]" aria-hidden="true">close</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.filtro-kanban-scroll {
  cursor: grab;
  scrollbar-width: none;
}

.filtro-kanban-scroll .filtro-kanban-chip {
  cursor: grab;
}

.filtro-kanban-scroll::-webkit-scrollbar {
  display: none;
}

.filtro-kanban-scroll.is-dragging {
  cursor: grabbing;
  user-select: none;
}

.filtro-kanban-scroll.is-dragging .filtro-kanban-chip {
  cursor: grabbing;
}
</style>
