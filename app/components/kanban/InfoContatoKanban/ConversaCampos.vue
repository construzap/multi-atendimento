<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import BaseInput from '../../BaseInput.vue'
import ModalAlerta from '../../ModalAlerta.vue'
import ModalCriarCampoPersonalizado from '~/components/chat/area-info-conversa/ModalCriarCampoPersonalizado.vue'
import type { CampoPersonalizado, TipoCampoPersonalizado } from '#shared/types/camposPersonalizados'
import type { KanbanCampoPersonalizadoResumo } from '#shared/types/kanban'
import { useCamposPersonalizadosStore } from '../../../stores/camposPersonalizados'
import { useKanbanStore } from '../../../stores/kanban'
import { useWorkspacesStore } from '../../../stores/workspaces'

const TIPOS_FORMULARIO = new Set<TipoCampoPersonalizado>(['text', 'number', 'date', 'boolean'])

const INPUT_CLASS =
  '!rounded-lg !border-outline/30 !bg-white !py-2 text-sm dark:!border-dark-outline/30 dark:!bg-dark-surface-container-low'

const SELECT_CLASS =
  'w-full rounded-lg border border-outline/30 bg-white px-3 py-2 text-sm text-on-surface shadow-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50 dark:border-dark-outline/30 dark:bg-dark-surface-container-low dark:text-dark-on-surface'

const route = useRoute()
const kanban = useKanbanStore()
const workspacesStore = useWorkspacesStore()
const camposStore = useCamposPersonalizadosStore()

const { workspaceIdLoaded, infoContatoConversaKey, infoContatoCard } = storeToRefs(kanban)

const modalAberto = ref(false)
const campoEmEdicao = ref<KanbanCampoPersonalizadoResumo | null>(null)
const modalExcluirCampo = ref(false)
const campoParaExcluir = ref<KanbanCampoPersonalizadoResumo | null>(null)
const excluindoCampo = ref(false)
const draftPorCampo = ref<Record<number, string>>({})
const ultimoSalvoPorCampo = ref<Record<number, string>>({})
const salvandoPorCampo = ref<Record<number, boolean>>({})

const debouncers = new Map<number, ReturnType<typeof setTimeout>>()

const workspaceId = computed(() => {
  if (workspaceIdLoaded.value != null && Number.isFinite(workspaceIdLoaded.value) && workspaceIdLoaded.value > 0) {
    return workspaceIdLoaded.value
  }
  const raw = workspacesStore.currentWorkspaceId ?? String(route.params.id ?? '')
  const n = Number.parseInt(String(raw).trim(), 10)
  return Number.isFinite(n) && n > 0 ? n : null
})

const conversaKey = computed(() => infoContatoConversaKey.value)

const camposDisponiveis = computed((): KanbanCampoPersonalizadoResumo[] => {
  return infoContatoCard.value?.campos_personalizados ?? []
})

const camposFormulario = computed(() =>
  camposDisponiveis.value.filter((campo) => TIPOS_FORMULARIO.has(campo.tipo)),
)

const podeAbrirModal = computed(() => workspaceId.value != null)

const campoParaModal = computed(() => {
  const campo = campoEmEdicao.value
  if (!campo) return null
  return { id: campo.id, nome: campo.nome, tipo: campo.tipo }
})

const textoConfirmarExclusaoCampo = computed(() => {
  const nome = campoParaExcluir.value?.nome?.trim()
  if (!nome) {
    return 'Deseja excluir este campo personalizado? Os valores salvos nas conversas também serão removidos.'
  }
  return `Deseja excluir o campo "${nome}"? Os valores salvos nas conversas também serão removidos.`
})

function valorParaDraft(tipo: TipoCampoPersonalizado, stored: string | null): string {
  if (tipo === 'boolean') {
    if (stored === 'true') return 'true'
    if (stored === 'false') return 'false'
    return ''
  }
  return stored ?? ''
}

function draftParaPayload(tipo: TipoCampoPersonalizado, draft: string): unknown {
  if (tipo === 'boolean') {
    if (draft === '') return null
    return draft === 'true'
  }
  if (tipo === 'number') {
    if (draft.trim() === '') return null
    return draft
  }
  if (tipo === 'date') {
    if (draft.trim() === '') return null
    return draft.trim()
  }
  if (draft.trim() === '') return null
  return draft.trim()
}

function syncDraftFromKanbanCard() {
  const key = conversaKey.value
  const card = infoContatoCard.value
  if (!key || !card) return

  const nextDraft: Record<number, string> = {}
  const nextSalvo: Record<number, string> = {}

  for (const campo of camposFormulario.value) {
    if (salvandoPorCampo.value[campo.id]) {
      nextDraft[campo.id] = draftPorCampo.value[campo.id] ?? ''
      nextSalvo[campo.id] = ultimoSalvoPorCampo.value[campo.id] ?? ''
      continue
    }

    const draft = valorParaDraft(campo.tipo, campo.valor)
    nextDraft[campo.id] = draft
    nextSalvo[campo.id] = draft
  }

  draftPorCampo.value = nextDraft
  ultimoSalvoPorCampo.value = nextSalvo
}

function getDraft(campoId: number): string {
  return draftPorCampo.value[campoId] ?? ''
}

function onDraftChange(campo: KanbanCampoPersonalizadoResumo, value: string) {
  draftPorCampo.value[campo.id] = value

  const prev = debouncers.get(campo.id)
  if (prev) clearTimeout(prev)

  debouncers.set(
    campo.id,
    setTimeout(() => {
      void salvarDraftCampo(campo)
      debouncers.delete(campo.id)
    }, 600),
  )
}

function onDraftBlur(campo: KanbanCampoPersonalizadoResumo) {
  const prev = debouncers.get(campo.id)
  if (prev) {
    clearTimeout(prev)
    debouncers.delete(campo.id)
  }
  void salvarDraftCampo(campo)
}

async function salvarDraftCampo(campo: KanbanCampoPersonalizadoResumo) {
  const wsId = workspaceId.value
  const key = conversaKey.value
  if (wsId == null || !key) return

  const draft = getDraft(campo.id)
  const ultimo = ultimoSalvoPorCampo.value[campo.id] ?? ''
  if (draft === ultimo) return

  salvandoPorCampo.value[campo.id] = true
  try {
    const salvo = await camposStore.salvarValor(wsId, key, campo.id, draftParaPayload(campo.tipo, draft))
    const draftSalvo = valorParaDraft(campo.tipo, salvo.valor)
    draftPorCampo.value[campo.id] = draftSalvo
    ultimoSalvoPorCampo.value[campo.id] = draftSalvo
    kanban.atualizarCampoPersonalizadoNoCard(key, {
      id: campo.id,
      nome: campo.nome,
      tipo: campo.tipo,
      valor: salvo.valor,
    })
  } catch {
    toast.error(camposStore.error ?? 'Não foi possível salvar o valor.', { duration: 8000 })
    draftPorCampo.value[campo.id] = ultimo
  } finally {
    salvandoPorCampo.value[campo.id] = false
  }
}

function abrirModalCriar() {
  if (!podeAbrirModal.value) return
  campoEmEdicao.value = null
  modalAberto.value = true
}

function abrirModalEditar(campo: KanbanCampoPersonalizadoResumo) {
  if (!podeAbrirModal.value) return
  campoEmEdicao.value = campo
  modalAberto.value = true
}

function onCampoSalvo(campo: CampoPersonalizado) {
  const key = conversaKey.value
  if (!key) return

  const existente = infoContatoCard.value?.campos_personalizados?.find((c) => c.id === campo.id)
  kanban.atualizarCampoPersonalizadoNoCard(key, {
    id: campo.id,
    nome: campo.nome,
    tipo: campo.tipo,
    valor: existente?.valor ?? null,
  })
  syncDraftFromKanbanCard()
}

function solicitarExcluirCampo(campo: KanbanCampoPersonalizadoResumo) {
  campoParaExcluir.value = campo
  modalExcluirCampo.value = true
}

async function confirmarExcluirCampo() {
  const campo = campoParaExcluir.value
  const wsId = workspaceId.value
  if (!campo || wsId == null) {
    modalExcluirCampo.value = false
    return
  }

  excluindoCampo.value = true
  try {
    await camposStore.excluirCampo(wsId, campo.id)
    const key = conversaKey.value
    if (key) kanban.removerCampoPersonalizadoDoCard(key, campo.id)
    toast.success('Campo personalizado excluído.')

    const { [campo.id]: _draft, ...restDraft } = draftPorCampo.value
    const { [campo.id]: _salvo, ...restSalvo } = ultimoSalvoPorCampo.value
    draftPorCampo.value = restDraft
    ultimoSalvoPorCampo.value = restSalvo

    modalExcluirCampo.value = false
    campoParaExcluir.value = null
  } catch {
    toast.error(camposStore.error ?? 'Não foi possível excluir o campo.', { duration: 8000 })
  } finally {
    excluindoCampo.value = false
  }
}

watch(
  [
    conversaKey,
    () => camposFormulario.value.map((c) => c.id).join(','),
    () => infoContatoCard.value?.campos_personalizados,
  ],
  () => syncDraftFromKanbanCard(),
  { immediate: true, deep: true },
)

watch(modalAberto, (aberto) => {
  if (!aberto) campoEmEdicao.value = null
})

watch(modalExcluirCampo, (aberto) => {
  if (!aberto && !excluindoCampo.value) campoParaExcluir.value = null
})

onUnmounted(() => {
  for (const timer of debouncers.values()) clearTimeout(timer)
  debouncers.clear()
})
</script>

<template>
  <section class="space-y-3 rounded-2xl border border-outline/30 bg-surface-container-low p-4 dark:border-dark-outline/30 dark:bg-dark-surface-container-high/40">
    <div class="flex flex-col gap-3">
      <h4 class="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
        Campos personalizados
      </h4>

      <div
        v-if="camposFormulario.length > 0"
        class="space-y-4 rounded-xl border border-outline/20 bg-white/60 p-3 dark:border-dark-outline/20 dark:bg-dark-surface-container-low/60"
      >
        <div
          v-for="campo in camposFormulario"
          :key="campo.id"
          class="space-y-1.5"
        >
          <div class="flex items-start justify-between gap-2">
            <label
              :for="`campo-valor-${campo.id}`"
              class="min-w-0 flex-1 text-xs font-semibold text-on-surface dark:text-dark-on-surface"
            >
              {{ campo.nome }}
            </label>

            <div class="flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                class="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-surface-container-high hover:text-primary dark:text-slate-400 dark:hover:bg-dark-surface-container-high dark:hover:text-primary"
                aria-label="Editar definição do campo"
                @click="abrirModalEditar(campo)"
              >
                <span class="material-symbols-outlined text-[16px]" aria-hidden="true">edit</span>
              </button>
              <button
                type="button"
                class="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                aria-label="Excluir campo"
                :disabled="excluindoCampo"
                @click="solicitarExcluirCampo(campo)"
              >
                <span class="material-symbols-outlined text-[16px]" aria-hidden="true">delete</span>
              </button>
            </div>
          </div>

          <BaseInput
            v-if="campo.tipo === 'text'"
            :id="`campo-valor-${campo.id}`"
            :model-value="getDraft(campo.id)"
            type="text"
            placeholder="Digite o valor…"
            autocomplete="off"
            :input-class="INPUT_CLASS"
            @update:model-value="onDraftChange(campo, $event)"
            @blur="onDraftBlur(campo)"
          />

          <BaseInput
            v-else-if="campo.tipo === 'number'"
            :id="`campo-valor-${campo.id}`"
            :model-value="getDraft(campo.id)"
            type="number"
            inputmode="decimal"
            placeholder="0"
            autocomplete="off"
            :input-class="INPUT_CLASS"
            @update:model-value="onDraftChange(campo, $event)"
            @blur="onDraftBlur(campo)"
          />

          <BaseInput
            v-else-if="campo.tipo === 'date'"
            :id="`campo-valor-${campo.id}`"
            :model-value="getDraft(campo.id)"
            type="date"
            autocomplete="off"
            :input-class="INPUT_CLASS"
            @update:model-value="onDraftChange(campo, $event)"
            @blur="onDraftBlur(campo)"
          />

          <select
            v-else-if="campo.tipo === 'boolean'"
            :id="`campo-valor-${campo.id}`"
            :value="getDraft(campo.id)"
            :class="SELECT_CLASS"
            @change="onDraftChange(campo, ($event.target as HTMLSelectElement).value)"
            @blur="onDraftBlur(campo)"
          >
            <option value="">Selecione…</option>
            <option value="true">Sim</option>
            <option value="false">Não</option>
          </select>

          <p
            v-if="salvandoPorCampo[campo.id]"
            class="text-[10px] font-medium text-on-surface-variant dark:text-dark-on-surface-variant"
          >
            Salvando…
          </p>
        </div>
      </div>

      <p
        v-else-if="camposDisponiveis.length > 0"
        class="rounded-xl border border-outline/20 bg-white/60 px-3 py-3 text-sm text-on-surface-variant dark:border-dark-outline/20 dark:bg-dark-surface-container-low/60 dark:text-dark-on-surface-variant"
      >
        Nenhum campo com tipo suportado (texto, número, data ou sim/não).
      </p>

      <p
        v-else
        class="rounded-xl border border-dashed border-outline/30 bg-white/40 px-3 py-4 text-center text-sm text-on-surface-variant dark:border-dark-outline/30 dark:bg-dark-surface-container-low/40 dark:text-dark-on-surface-variant"
      >
        Nenhum campo personalizado nesta conversa.
      </p>

      <button
        type="button"
        class="inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-xl border border-outline/40 bg-white px-3 py-2 text-sm font-semibold text-on-surface shadow-sm transition-colors hover:bg-surface-container-high dark:border-dark-outline/40 dark:bg-dark-surface-container-low dark:text-dark-on-surface dark:hover:bg-dark-surface-container-high"
        :disabled="!podeAbrirModal"
        @click="abrirModalCriar"
      >
        <span class="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
        Adicionar campo personalizado
      </button>
    </div>

    <ModalCriarCampoPersonalizado
      v-if="workspaceId != null"
      v-model:open="modalAberto"
      :workspace-id="workspaceId"
      :campo="campoParaModal"
      @salvo="onCampoSalvo"
    />

    <ModalAlerta
      v-model:open="modalExcluirCampo"
      title="Excluir campo personalizado"
      :texto="textoConfirmarExclusaoCampo"
      variante="perigo"
      texto-confirmar="Excluir"
      :confirmar-desabilitado="excluindoCampo"
      @confirmar="confirmarExcluirCampo"
    />
  </section>
</template>
