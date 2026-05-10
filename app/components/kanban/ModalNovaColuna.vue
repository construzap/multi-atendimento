<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import BaseModal from '~/components/BaseModal.vue'
import BaseInput from '~/components/BaseInput.vue'
import type { KanbanColumn } from '#shared/types/kanban'
import { useKanbanStore } from '~/stores/kanban'

const props = withDefaults(
  defineProps<{
    open: boolean
    workspaceId: number
    mode?: 'create' | 'edit'
    /** Preenchido quando `mode === 'edit'`. */
    column?: KanbanColumn | null
  }>(),
  {
    mode: 'create',
    column: null,
  },
)

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const kanban = useKanbanStore()

const nome = ref('')
const cor = ref('#38BDF8')
const submitting = ref(false)

const tituloModal = computed(() =>
  props.mode === 'edit' ? 'Editar coluna' : 'Nova coluna',
)

const podeSalvar = computed(() => {
  return Boolean(kanban.funilId && kanban.funilId > 0 && props.workspaceId > 0 && nome.value.trim())
})

watch(
  () => [props.open, props.mode, props.column] as const,
  ([aberto, mode, col]) => {
    if (!aberto) return
    submitting.value = false
    if (mode === 'edit' && col) {
      nome.value = col.nome?.trim() ?? ''
      const c = col.cor?.trim()
      cor.value =
        c && /^#[0-9A-Fa-f]{6}$/.test(c) ? c : '#38BDF8'
    } else {
      nome.value = ''
      cor.value = '#38BDF8'
    }
  },
)

async function onSalvar() {
  if (!podeSalvar.value || submitting.value) return
  submitting.value = true
  try {
    let ok = false
    if (props.mode === 'edit' && props.column) {
      ok = await kanban.updateColumn({
        workspaceId: props.workspaceId,
        colunaId: props.column.id,
        nome: nome.value,
        cor: cor.value.trim() || null,
      })
    } else {
      ok = await kanban.createColumn({
        workspaceId: props.workspaceId,
        nome: nome.value,
        cor: cor.value.trim() || null,
      })
    }
    if (ok) emit('update:open', false)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <BaseModal
    :open="props.open"
    :title="tituloModal"
    panel-class="w-full max-w-lg"
    @update:open="emit('update:open', $event)"
  >
    <div v-if="!kanban.funilId || kanban.funilId < 1" class="text-sm text-amber-800 dark:text-amber-200">
      Não há funil configurado neste workspace. Crie o funil antes de adicionar colunas.
    </div>

    <div v-else class="flex flex-col gap-4">
      <div>
        <label class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-dark-on-surface" for="nova-coluna-nome">
          Nome da etapa
        </label>
        <BaseInput
          id="nova-coluna-nome"
          v-model="nome"
          placeholder="Ex.: Em negociação"
          :disabled="submitting"
          autocomplete="off"
        />
      </div>

      <div>
        <label class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-dark-on-surface" for="nova-coluna-cor">
          Cor (hex)
        </label>
        <div class="flex flex-wrap items-center gap-3">
          <input
            id="nova-coluna-cor-picker"
            v-model="cor"
            type="color"
            class="h-10 w-14 cursor-pointer rounded-lg border border-outline/40 bg-white p-1 dark:border-dark-outline/40"
            :disabled="submitting"
            aria-label="Seletor de cor"
          />
          <BaseInput
            id="nova-coluna-cor"
            v-model="cor"
            placeholder="#38BDF8"
            pattern="^#[0-9A-Fa-f]{6}$"
            title="Formato #RRGGBB"
            class="max-w-[11rem]"
            :disabled="submitting"
            autocomplete="off"
          />
        </div>
      </div>
    </div>

    <template #footer>
      <button
        type="button"
        class="rounded-xl border border-outline/40 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-dark-outline/40 dark:bg-dark-surface-container-low dark:text-dark-on-surface dark:hover:bg-dark-surface-container"
        :disabled="submitting"
        @click="emit('update:open', false)"
      >
        Cancelar
      </button>
      <button
        type="button"
        class="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-50"
        :disabled="!podeSalvar || submitting"
        @click="onSalvar"
      >
        {{ submitting ? 'Salvando…' : 'Salvar' }}
      </button>
    </template>
  </BaseModal>
</template>
