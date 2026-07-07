<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { useKanbanStore } from '../../../stores/kanban'
import { useKanbanConversaCampoEditavel } from './useKanbanConversaCampoEditavel'

const props = defineProps<{
  conversaKey: string
  colunaId: number | null
  etapaNome: string | null
  conversaEditavel?: boolean
  nomeEditavel?: boolean
  workspaceId?: number | null
}>()

const emit = defineEmits<{
  etapaSalva: [payload: { coluna_id: number; etapa_nome: string }]
}>()

const { podeEditar } = useKanbanConversaCampoEditavel({
  conversaKey: () => props.conversaKey,
  conversaEditavel: () => props.conversaEditavel,
  nomeEditavel: () => props.nomeEditavel,
  workspaceId: () => props.workspaceId,
})

const kanbanStore = useKanbanStore()

const editando = ref(false)
const colunaDraft = ref('')
const salvando = ref(false)

const colunas = computed(() => kanbanStore.columns)

const display = computed(() => {
  const nome = props.etapaNome?.trim()
  if (nome) return nome
  if (props.colunaId != null && props.colunaId > 0) {
    const col = colunas.value.find((c) => c.id === props.colunaId)
    return col?.nome?.trim() || `Coluna #${props.colunaId}`
  }
  return '—'
})

watch(
  () => props.colunaId,
  () => {
    if (!editando.value) {
      colunaDraft.value =
        props.colunaId != null && props.colunaId > 0 ? String(props.colunaId) : ''
    }
  },
  { immediate: true },
)

function iniciarEdicao() {
  if (!podeEditar.value || colunas.value.length === 0) return
  colunaDraft.value =
    props.colunaId != null && props.colunaId > 0 ? String(props.colunaId) : ''
  editando.value = true
}

function cancelarEdicao() {
  editando.value = false
  colunaDraft.value =
    props.colunaId != null && props.colunaId > 0 ? String(props.colunaId) : ''
}

async function salvarEtapa() {
  if (!podeEditar.value || salvando.value) return

  const wid = props.workspaceId
  const key = props.conversaKey.trim()
  const novaColunaId = Number.parseInt(colunaDraft.value, 10)
  if (wid == null || wid < 1 || !key || !Number.isFinite(novaColunaId) || novaColunaId < 1) return

  const colunaAtual = props.colunaId
  if (colunaAtual === novaColunaId) {
    editando.value = false
    return
  }

  const coluna = colunas.value.find((c) => c.id === novaColunaId)
  if (!coluna) {
    toast.error('Selecione uma etapa válida.')
    return
  }

  const fromColumnId =
    colunaAtual != null && colunaAtual > 0 ? String(colunaAtual) : String(novaColunaId)

  salvando.value = true
  try {
    await kanbanStore.moveCard({
      workspaceId: wid,
      conversaKey: key,
      fromColumnId,
      toColumnId: String(novaColunaId),
    })

    if (kanbanStore.infoContatoCard?.coluna_id === novaColunaId) {
      emit('etapaSalva', { coluna_id: novaColunaId, etapa_nome: coluna.nome })
      editando.value = false
      toast.success('Etapa do funil atualizada.')
    }
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-0.5">
    <dt class="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
      Etapa do funil
    </dt>
    <dd class="text-sm font-medium text-on-surface dark:text-dark-on-surface">
      <div v-if="editando" class="space-y-2">
        <select
          v-model="colunaDraft"
          class="w-full rounded-xl border border-outline/40 bg-white px-3 py-2 text-sm text-on-surface outline-none focus:border-primary dark:border-dark-outline/40 dark:bg-dark-surface-container-low dark:text-dark-on-surface"
          :disabled="salvando || colunas.length === 0"
        >
          <option value="" disabled>Selecione uma etapa</option>
          <option v-for="coluna in colunas" :key="coluna.id" :value="String(coluna.id)">
            {{ coluna.nome }}
          </option>
        </select>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="inline-flex items-center gap-1 rounded-lg bg-primary-600 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-primary-700 disabled:opacity-60 dark:bg-primary-500 dark:hover:bg-primary-600"
            :disabled="salvando || !colunaDraft"
            @click="salvarEtapa"
          >
            Salvar
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-1 rounded-lg border border-outline/40 px-2.5 py-1 text-xs font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-60 dark:border-dark-outline/40 dark:text-dark-on-surface dark:hover:bg-dark-surface-container-high"
            :disabled="salvando"
            @click="cancelarEdicao"
          >
            Cancelar
          </button>
        </div>
      </div>

      <div v-else class="flex min-w-0 items-center gap-1">
        <span class="min-w-0 flex-1">{{ display }}</span>
        <button
          v-if="podeEditar && colunas.length > 0"
          type="button"
          class="shrink-0 rounded-lg p-1 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-primary-600 dark:text-dark-on-surface-variant dark:hover:bg-dark-surface-container-high dark:hover:text-primary-400"
          aria-label="Editar etapa do funil"
          @click="iniciarEdicao"
        >
          <span class="material-symbols-outlined text-[16px]" aria-hidden="true">edit</span>
        </button>
      </div>
    </dd>
  </div>
</template>
