<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import BaseButton from '~/components/BaseButton.vue'
import BaseInput from '~/components/BaseInput.vue'
import ModalAlerta from '~/components/ModalAlerta.vue'
import PromptSelecionado from '~/components/admin/prompt/PromptSelecionado.vue'
import type { KanbanBoardResponse, KanbanCard } from '#shared/types/kanban'
import { mensagemErroFetch } from '~/stores/canais'

const adminStore = useAdminStore()
const {
  selectedWorkspaceId,
  promptItens,
  promptsPending,
  promptsLoaded,
  promptsError,
  promptModalAberto,
  promptEmEdicaoId,
  promptSalvando,
} = storeToRefs(adminStore)

const carregandoPrompts = computed(() => promptsPending.value && !promptsLoaded.value)

const buscaMemoriaIa = ref('')
const conversaMemoriaIa = ref<KanbanCard | null>(null)
const resultadosBuscaMemoriaIa = ref<KanbanCard[]>([])
const buscandoMemoriaIa = ref(false)
const dropdownBuscaAberto = ref(false)
const modalApagarMemoriaIaAberto = ref(false)
const apagandoMemoriaIa = ref(false)

let buscaMemoriaTimer: ReturnType<typeof setTimeout> | null = null
let buscaMemoriaSeq = 0

const workspaceIdNum = computed(() => {
  const n = Number.parseInt(String(selectedWorkspaceId.value ?? ''), 10)
  return Number.isFinite(n) && n > 0 ? n : null
})

const podeApagarMemoriaIa = computed(
  () =>
    Boolean(
      workspaceIdNum.value &&
        conversaMemoriaIa.value?.conversa_key?.trim() &&
        !apagandoMemoriaIa.value,
    ),
)

const textoModalApagarMemoriaIa = computed(() => {
  const c = conversaMemoriaIa.value
  const label = (c?.name?.trim() || c?.phone?.trim() || c?.conversa_key || '—').trim()
  return `Isso vai apagar a memória da I.A. para ${label} e ligar o atendimento da I.A. para este contato. Esta ação não poderá ser desfeita. Tem certeza?`
})

function cardsDoBoard(board: KanbanBoardResponse): KanbanCard[] {
  const seen = new Set<string>()
  const out: KanbanCard[] = []
  for (const coluna of board.columns ?? []) {
    for (const card of coluna.cards ?? []) {
      const key = card.conversa_key?.trim()
      if (!key || seen.has(key)) continue
      if (card.is_group === true) continue
      seen.add(key)
      out.push(card)
    }
  }
  return out
}

function limparBuscaMemoriaIa() {
  if (buscaMemoriaTimer) {
    clearTimeout(buscaMemoriaTimer)
    buscaMemoriaTimer = null
  }
  buscaMemoriaIa.value = ''
  conversaMemoriaIa.value = null
  resultadosBuscaMemoriaIa.value = []
  buscandoMemoriaIa.value = false
  dropdownBuscaAberto.value = false
  modalApagarMemoriaIaAberto.value = false
}

watch(
  selectedWorkspaceId,
  (id) => {
    limparBuscaMemoriaIa()
    if (id) {
      adminStore.fetchPromptsSeNecessario(id).catch(() => {})
    }
  },
  { immediate: true },
)

async function buscarConversasMemoriaIa(termo: string) {
  const wsId = workspaceIdNum.value
  const q = termo.trim()
  if (!wsId || q.length < 1) {
    resultadosBuscaMemoriaIa.value = []
    buscandoMemoriaIa.value = false
    return
  }

  const seq = ++buscaMemoriaSeq
  buscandoMemoriaIa.value = true
  try {
    const board = await $fetch<KanbanBoardResponse>('/api/kanban', {
      method: 'GET',
      query: {
        workspace_id: wsId,
        q,
        is_group: false,
      },
    })
    if (seq !== buscaMemoriaSeq) return
    resultadosBuscaMemoriaIa.value = cardsDoBoard(board)
    dropdownBuscaAberto.value = true
  } catch (err) {
    if (seq !== buscaMemoriaSeq) return
    resultadosBuscaMemoriaIa.value = []
    toast.error(mensagemErroFetch(err, 'Não foi possível buscar conversas.'))
  } finally {
    if (seq === buscaMemoriaSeq) buscandoMemoriaIa.value = false
  }
}

function agendarBuscaMemoriaIa() {
  if (buscaMemoriaTimer) clearTimeout(buscaMemoriaTimer)
  const termo = buscaMemoriaIa.value.trim()
  if (!termo) {
    resultadosBuscaMemoriaIa.value = []
    buscandoMemoriaIa.value = false
    dropdownBuscaAberto.value = false
    return
  }
  buscaMemoriaTimer = setTimeout(() => {
    buscaMemoriaTimer = null
    void buscarConversasMemoriaIa(termo)
  }, 300)
}

function onInputBuscaMemoriaIa() {
  conversaMemoriaIa.value = null
  dropdownBuscaAberto.value = true
  agendarBuscaMemoriaIa()
}

function selecionarConversaMemoriaIa(card: KanbanCard) {
  conversaMemoriaIa.value = card
  buscaMemoriaIa.value = [card.name?.trim(), card.phone?.trim()].filter(Boolean).join(' · ')
  resultadosBuscaMemoriaIa.value = []
  dropdownBuscaAberto.value = false
}

function labelConversaMemoria(card: KanbanCard): string {
  return card.name?.trim() || 'Sem nome'
}

function abrirModalApagarMemoriaIa() {
  if (!podeApagarMemoriaIa.value) return
  modalApagarMemoriaIaAberto.value = true
}

async function confirmarApagarMemoriaIa() {
  const wsId = workspaceIdNum.value
  const c = conversaMemoriaIa.value
  const key = c?.conversa_key?.trim()
  if (!wsId || !key || apagandoMemoriaIa.value) return

  apagandoMemoriaIa.value = true
  try {
    await $fetch('/api/conversas/apagar-memoria-ia', {
      method: 'POST',
      body: {
        workspace_id: wsId,
        key,
        phone: c.phone?.trim() || undefined,
      },
    })
    modalApagarMemoriaIaAberto.value = false
    toast.success('Memória da I.A. apagada para este contato.')
  } catch (err) {
    toast.error(mensagemErroFetch(err, 'Não foi possível apagar a memória da I.A.'))
  } finally {
    apagandoMemoriaIa.value = false
  }
}

onUnmounted(() => {
  if (buscaMemoriaTimer) clearTimeout(buscaMemoriaTimer)
})

function selecionarPrompt(id: string) {
  adminStore.abrirModalPrompt(id)
}

function criarPrompt() {
  if (!selectedWorkspaceId.value) {
    toast.warning('Selecione um workspace na barra lateral.')
    return
  }
  adminStore.abrirModalPromptNovo()
}

function promptSelecionado(id: string) {
  return promptEmEdicaoId.value === id
}

async function onSalvar(payload: { titulo: string; conteudo: string; principal: boolean; tipo: string }) {
  try {
    const isNovo = await adminStore.salvarPrompt(payload)
    toast.success(isNovo ? 'Prompt criado com sucesso.' : 'Prompt atualizado com sucesso.')
  } catch (err) {
    toast.error(mensagemErroFetch(err, 'Não foi possível salvar o prompt.'))
  }
}

async function onExcluir() {
  try {
    await adminStore.excluirPromptAtual()
    toast.success('Prompt excluído.')
  } catch (err) {
    toast.error(mensagemErroFetch(err, 'Não foi possível excluir o prompt.'))
  }
}

function formatarData(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}
</script>

<template>
  <div class="flex min-h-0 flex-col gap-4">
    <div class="overflow-hidden rounded-2xl border border-outline/40 bg-surface-container-lowest shadow-sm dark:border-dark-outline/40 dark:bg-dark-surface-container-low">
      <div class="flex items-center justify-between gap-3 border-b border-outline/40 px-4 py-4 dark:border-dark-outline/40">
        <div>
          <h3 class="font-headline text-sm font-bold text-on-surface dark:text-dark-on-surface">
            Editor de prompt
          </h3>
          <p class="text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
            <template v-if="!selectedWorkspaceId">
              Selecione um workspace na barra lateral
            </template>
            <template v-else-if="carregandoPrompts">
              Carregando...
            </template>
            <template v-else>
              {{ promptItens.length }} cadastrado(s) — clique para editar
            </template>
          </p>
        </div>
        <BaseButton
          id="btn-novo-prompt"
          variant="secondary"
          size="sm"
          :block="false"
          :disabled="!selectedWorkspaceId || carregandoPrompts || promptSalvando"
          @click="criarPrompt"
        >
          + Novo
        </BaseButton>
      </div>

      <div
        v-if="!selectedWorkspaceId"
        class="px-6 py-16 text-center text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
      >
        Escolha um workspace na barra lateral para gerenciar os prompts.
      </div>

      <div
        v-else-if="carregandoPrompts"
        class="flex items-center justify-center gap-2 px-6 py-16 text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
      >
        <svg class="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Carregando prompts...
      </div>

      <div
        v-else-if="promptsError"
        class="px-6 py-10 text-center text-sm text-danger dark:text-dark-danger"
      >
        {{ promptsError }}
      </div>

      <div
        v-else-if="!promptItens.length"
        class="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center"
      >
        <div
          class="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-container-high text-on-surface-variant dark:bg-dark-surface-container-high dark:text-dark-on-surface-variant"
          aria-hidden="true"
        >
          <svg class="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path
              d="M9.5 7.5H14.5M9.5 11H13M7 3h10a2 2 0 0 1 2 2v14l-3.5-2-3.5 2-3.5-2-3.5 2V5a2 2 0 0 1 2-2z"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>
        <p class="text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
          Nenhum prompt criado. Clique em &ldquo;Novo&rdquo; para começar.
        </p>
        <BaseButton
          id="btn-criar-primeiro-prompt"
          variant="primary"
          size="sm"
          class="max-w-xs"
          @click="criarPrompt"
        >
          Criar primeiro prompt
        </BaseButton>
      </div>

      <ul v-else class="divide-y divide-outline/30 dark:divide-dark-outline/30">
        <li v-for="p in promptItens" :key="p.id">
          <button
            type="button"
            class="flex w-full flex-col gap-1 px-4 py-4 text-left transition-colors hover:bg-surface-container-high/70 dark:hover:bg-dark-surface-container-high/50"
            :class="promptSelecionado(p.id) ? 'bg-primary-50/80 dark:bg-primary-900/20' : ''"
            @click="selecionarPrompt(p.id)"
          >
            <div class="flex items-start justify-between gap-2">
              <p class="line-clamp-1 text-sm font-semibold text-on-surface dark:text-dark-on-surface">
                {{ p.titulo }}
              </p>
              <span
                v-if="p.principal"
                class="shrink-0 rounded-md bg-primary-500 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
              >
                Principal
              </span>
            </div>
            <p class="line-clamp-2 text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
              {{ p.conteudo || 'Sem conteúdo' }}
            </p>
            <p class="text-[10px] text-on-surface-variant/70 dark:text-dark-on-surface-variant/70">
              Atualizado {{ formatarData(p.atualizadoEm) }}
            </p>
          </button>
        </li>
      </ul>
    </div>

    <div
      v-if="selectedWorkspaceId"
      class="relative z-30 rounded-2xl border border-rose-400/70 bg-rose-50 p-4 shadow-sm dark:border-rose-500/50 dark:bg-rose-950/40"
    >
      <h3 class="font-headline text-sm font-bold text-rose-800 dark:text-rose-200">
        Memória da I.A.
      </h3>
      <p class="mt-0.5 text-xs text-rose-700/80 dark:text-rose-300/80">
        Busque pelo nome ou telefone, selecione a conversa e depois apague a memória.
      </p>
      <div class="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div class="relative min-w-0 flex-1">
          <label
            for="admin-apagar-memoria-ia-busca"
            class="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300"
          >
            Nome ou telefone
          </label>
          <BaseInput
            id="admin-apagar-memoria-ia-busca"
            v-model="buscaMemoriaIa"
            name="busca-memoria-ia"
            type="search"
            autocomplete="off"
            placeholder="Digite para buscar..."
            :disabled="apagandoMemoriaIa"
            @input="onInputBuscaMemoriaIa"
            @focus="dropdownBuscaAberto = buscaMemoriaIa.trim().length > 0"
          />
          <div
            v-if="dropdownBuscaAberto && (buscandoMemoriaIa || resultadosBuscaMemoriaIa.length > 0 || buscaMemoriaIa.trim())"
            class="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-rose-300/60 bg-white shadow-lg dark:border-rose-500/40 dark:bg-dark-surface-container-low"
          >
            <p
              v-if="buscandoMemoriaIa"
              class="px-3 py-2 text-xs text-rose-700/80 dark:text-rose-300/80"
            >
              Buscando...
            </p>
            <p
              v-else-if="!resultadosBuscaMemoriaIa.length"
              class="px-3 py-2 text-xs text-rose-700/80 dark:text-rose-300/80"
            >
              Nenhuma conversa encontrada.
            </p>
            <button
              v-for="card in resultadosBuscaMemoriaIa"
              :key="card.conversa_key"
              type="button"
              class="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-rose-50 dark:hover:bg-rose-950/50"
              @mousedown.prevent="selecionarConversaMemoriaIa(card)"
            >
              <span class="text-sm font-semibold text-on-surface dark:text-dark-on-surface">
                {{ labelConversaMemoria(card) }}
              </span>
              <span class="text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
                {{ card.phone?.trim() || 'Sem telefone' }}
              </span>
            </button>
          </div>
          <p
            v-if="conversaMemoriaIa"
            class="mt-1.5 text-[11px] font-medium text-rose-800 dark:text-rose-200"
          >
            Selecionada: {{ labelConversaMemoria(conversaMemoriaIa) }}
            <template v-if="conversaMemoriaIa.phone"> · {{ conversaMemoriaIa.phone }}</template>
          </p>
        </div>
        <button
          type="button"
          class="inline-flex shrink-0 items-center justify-center gap-1 rounded-lg bg-rose-600 px-3 py-2 text-[11px] font-semibold text-white transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-rose-600 dark:hover:bg-rose-500 sm:mb-0.5"
          :disabled="!podeApagarMemoriaIa"
          aria-label="Apagar memória da I.A. para a conversa selecionada"
          @click="abrirModalApagarMemoriaIa"
        >
          <span class="material-symbols-outlined text-[14px]" aria-hidden="true">memory_alt</span>
          Apagar memória da I.A.
        </button>
      </div>
    </div>

    <PromptSelecionado
      v-if="promptModalAberto"
      :salvando="promptSalvando"
      @close="adminStore.fecharModalPrompt()"
      @save="onSalvar"
      @delete="onExcluir"
    />

    <ModalAlerta
      v-model:open="modalApagarMemoriaIaAberto"
      title="Apagar memória da I.A.?"
      :texto="textoModalApagarMemoriaIa"
      variante="perigo"
      texto-confirmar="Apagar memória"
      texto-cancelar="Cancelar"
      :confirmar-desabilitado="apagandoMemoriaIa"
      :cancelar-desabilitado="apagandoMemoriaIa"
      :mostrar-fechar="!apagandoMemoriaIa"
      @confirmar="confirmarApagarMemoriaIa"
    />
  </div>
</template>
