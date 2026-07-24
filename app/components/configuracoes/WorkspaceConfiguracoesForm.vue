<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { toast } from 'vue-sonner'
import BaseButton from '~/components/BaseButton.vue'
import BaseInput from '~/components/BaseInput.vue'
import ModalAlerta from '~/components/ModalAlerta.vue'
import WorkspaceDescricaoRichText from '~/components/configuracoes/WorkspaceDescricaoRichText.vue'
import { useConfiguracoesStore } from '~/stores/configuracoes'
import { useKanbanStore } from '~/stores/kanban'
import { useWorkspacesStore } from '~/stores/workspaces'

const route = useRoute()
const workspaces = useWorkspacesStore()
const configuracoes = useConfiguracoesStore()
const kanbanStore = useKanbanStore()
const { funis, funisPending } = storeToRefs(kanbanStore)

const workspaceId = computed(() => {
  const raw = workspaces.currentWorkspaceId ?? String(route.params.id ?? '')
  const n = Number.parseInt(String(raw).trim(), 10)
  return Number.isFinite(n) && n > 0 ? n : null
})

const workspace = computed(() => {
  const id = workspaceId.value
  if (!id) return null
  return workspaces.items.find((w) => w.id === id) ?? null
})

const modalExcluirAberto = ref(false)

const carregando = computed(() => {
  const id = workspaceId.value
  return id != null && configuracoes.carregando(id)
})

const desabilitado = computed(() => carregando.value || configuracoes.salvando)

const nome = computed({
  get: () => {
    const id = workspaceId.value
    return id != null ? configuracoes.doWorkspace(id)?.nome ?? '' : ''
  },
  set: (v: string) => {
    const id = workspaceId.value
    if (id != null) configuracoes.atualizarCampo(id, 'nome', v)
  },
})

const descricao = computed({
  get: () => {
    const id = workspaceId.value
    return id != null ? configuracoes.doWorkspace(id)?.descricao ?? '' : ''
  },
  set: (v: string) => {
    const id = workspaceId.value
    if (id != null) configuracoes.atualizarCampo(id, 'descricao', v)
  },
})

/** Valor do select: `funilId:colunaId` (ou '' se vazio). */
const origemLeadsSelecionada = computed({
  get: () => {
    const id = workspaceId.value
    if (id == null) return ''
    const cfg = configuracoes.doWorkspace(id)
    const funilId = cfg?.funil_origem_leads?.trim() ?? ''
    const colunaId = cfg?.coluna_origem_leads?.trim() ?? ''
    if (!funilId || !colunaId) return ''
    return `${funilId}:${colunaId}`
  },
  set: (v: string) => {
    const id = workspaceId.value
    if (id == null) return
    const raw = v.trim()
    if (!raw) {
      configuracoes.atualizarCampo(id, 'funil_origem_leads', null)
      configuracoes.atualizarCampo(id, 'coluna_origem_leads', null)
      return
    }
    const [funilRaw, colunaRaw] = raw.split(':')
    const funilId = (funilRaw ?? '').trim()
    const colunaId = (colunaRaw ?? '').trim()
    configuracoes.atualizarCampo(id, 'funil_origem_leads', funilId || null)
    configuracoes.atualizarCampo(id, 'coluna_origem_leads', colunaId || null)
  },
})

const opcoesOrigemLeads = computed(() => {
  const itens: Array<{ value: string }> = []
  for (const funil of funis.value) {
    for (const col of funil.columns ?? []) {
      itens.push({ value: `${funil.id}:${col.id}` })
    }
  }
  return itens
})

const origemSalvaValida = computed(() => {
  const valor = origemLeadsSelecionada.value
  if (!valor) return true
  return opcoesOrigemLeads.value.some((o) => o.value === valor)
})

const totalColunasFunis = computed(() => opcoesOrigemLeads.value.length)

watch(
  workspaceId,
  (wid) => {
    if (wid != null) void kanbanStore.ensureFunisLoaded(wid).catch(() => {})
  },
  { immediate: true },
)

const createdAtLabel = computed(() => {
  const raw = workspace.value?.created_at
  if (!raw) return '—'
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(d)
})

function abrirModalExcluir() {
  if (!workspace.value) {
    toast.error('Workspace não encontrado.')
    return
  }
  modalExcluirAberto.value = true
}

async function confirmarExclusaoWorkspace() {
  const w = workspace.value
  if (!w) {
    modalExcluirAberto.value = false
    return
  }

  try {
    await workspaces.deleteWorkspace(w.id)
    modalExcluirAberto.value = false
    toast.success('Workspace removido.')
    await navigateTo('/')
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Falha ao remover workspace.')
  }
}
</script>

<template>
  <section
    class="overflow-hidden rounded-2xl border border-outline/40 bg-surface-container-lowest shadow-sm transition-colors dark:border-dark-outline/40 dark:bg-dark-surface-container-low"
  >
    <div class="border-b border-outline/40 p-6 dark:border-dark-outline/40">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 class="font-headline text-lg font-bold text-on-surface dark:text-dark-on-surface">
            Workspace
          </h3>
          <p class="mt-1 font-body text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
            Edite as informações do seu workspace
          </p>
        </div>

        <div class="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <div class="w-full sm:w-40">
            <BaseButton
              id="btn-ws-config-deletar"
              type="button"
              variant="secondary"
              :disabled="workspaces.pending || desabilitado || !workspace"
              @click="abrirModalExcluir"
            >
              Deletar
            </BaseButton>
          </div>
        </div>
      </div>
    </div>

    <div class="p-6">
      <div
        v-if="!workspaceId"
        class="rounded-xl border border-outline/40 bg-surface-container-low p-4 text-sm text-on-surface-variant dark:border-dark-outline/40 dark:bg-dark-surface-container-high dark:text-dark-on-surface-variant"
      >
        Workspace não encontrado no estado atual.
      </div>

      <div
        v-else
        class="space-y-5"
        :class="{ 'pointer-events-none opacity-60': desabilitado }"
      >
        <div>
          <label class="mb-2 block text-sm font-semibold text-on-surface dark:text-dark-on-surface" for="ws-config-nome">
            Nome
          </label>
          <BaseInput id="ws-config-nome" v-model="nome" type="text" name="nome" autocomplete="off">
            <template #leading>
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M4 6h16M4 12h10M4 18h16" stroke-linecap="round" />
              </svg>
            </template>
          </BaseInput>
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-on-surface dark:text-dark-on-surface" for="ws-config-descricao">
            Descrição
          </label>
          <ClientOnly>
            <WorkspaceDescricaoRichText id="ws-config-descricao" v-model="descricao" />
            <template #fallback>
              <div
                class="min-h-[180px] rounded-xl border border-gray-200 bg-gray-50 dark:border-dark-outline/50 dark:bg-dark-surface-container-low"
                aria-hidden="true"
              />
            </template>
          </ClientOnly>
        </div>

        <div>
          <label
            class="mb-2 block text-sm font-semibold text-on-surface dark:text-dark-on-surface"
            for="ws-config-coluna-origem-leads"
          >
            Coluna origem dos leads
          </label>
          <p class="mb-3 text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
            Funil e coluna em que novos leads serão registrados pela IA.
          </p>
          <select
            id="ws-config-coluna-origem-leads"
            v-model="origemLeadsSelecionada"
            name="origem_leads"
            class="w-full rounded-xl border border-outline/40 bg-white px-4 py-3 text-sm text-on-surface outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-60 dark:border-dark-outline/40 dark:bg-dark-surface-container-low dark:text-dark-on-surface"
            :disabled="desabilitado || funisPending"
          >
            <option value="">Nenhuma coluna selecionada</option>
            <option
              v-if="origemLeadsSelecionada && !origemSalvaValida"
              :value="origemLeadsSelecionada"
            >
              Funil/coluna {{ origemLeadsSelecionada }} (não listados)
            </option>
            <optgroup
              v-for="funil in funis"
              :key="funil.id"
              :label="funil.nome?.trim() || `Funil #${funil.id}`"
            >
              <option
                v-for="col in funil.columns"
                :key="`${funil.id}:${col.id}`"
                :value="`${funil.id}:${col.id}`"
              >
                {{ col.nome?.trim() || `Coluna #${col.id}` }}
              </option>
            </optgroup>
          </select>
          <p
            v-if="funisPending"
            class="mt-2 text-xs text-on-surface-variant dark:text-dark-on-surface-variant"
          >
            Carregando funis e colunas…
          </p>
          <p
            v-else-if="!totalColunasFunis"
            class="mt-2 text-xs text-on-surface-variant dark:text-dark-on-surface-variant"
          >
            Nenhuma coluna encontrada. Crie funis/colunas no kanban do workspace.
          </p>
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-on-surface dark:text-dark-on-surface" for="ws-config-created-at">
            Data de criação
          </label>
          <BaseInput
            id="ws-config-created-at"
            :model-value="createdAtLabel"
            type="text"
            name="created_at"
            readonly
          >
            <template #leading>
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </template>
          </BaseInput>
        </div>
      </div>
    </div>

    <ModalAlerta
      v-model:open="modalExcluirAberto"
      title="Excluir workspace"
      texto="Tem certeza que deseja excluir este workspace? Ele será ocultado da sua lista."
      variante="perigo"
      texto-confirmar="Excluir"
      texto-cancelar="Cancelar"
      :confirmar-desabilitado="workspaces.pending"
      :cancelar-desabilitado="workspaces.pending"
      :mostrar-fechar="!workspaces.pending"
      @confirmar="confirmarExclusaoWorkspace"
    />
  </section>
</template>
