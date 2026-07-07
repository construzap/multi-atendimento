<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import BaseModal from '../../BaseModal.vue'
import BaseInput from '../../BaseInput.vue'
import type { CampoPersonalizado, TipoCampoPersonalizado } from '#shared/types/camposPersonalizados'
import { useCamposPersonalizadosStore } from '../../../stores/camposPersonalizados'

const TIPOS: { value: TipoCampoPersonalizado; label: string }[] = [
  { value: 'text', label: 'Texto' },
  { value: 'number', label: 'Número' },
  { value: 'date', label: 'Data' },
  { value: 'boolean', label: 'Sim/Não' },
]

const props = defineProps<{
  open: boolean
  workspaceId: number
  campo?: { id: number; nome: string; tipo: TipoCampoPersonalizado } | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  salvo: [campo: CampoPersonalizado]
}>()

const camposStore = useCamposPersonalizadosStore()

const nome = ref('')
const tipo = ref<TipoCampoPersonalizado>('text')
const submitting = ref(false)

const modoEdicao = computed(() => props.campo != null)

const tituloModal = computed(() =>
  modoEdicao.value ? 'Editar campo personalizado' : 'Novo campo personalizado',
)

const podeSalvar = computed(
  () => props.workspaceId > 0 && nome.value.trim().length > 0 && !submitting.value,
)

function resetForm() {
  submitting.value = false
  nome.value = ''
  tipo.value = 'text'
}

function preencherFormularioEdicao() {
  submitting.value = false
  if (!props.campo) return
  nome.value = props.campo.nome
  tipo.value = props.campo.tipo
}

watch(
  () => [props.open, props.campo?.id] as const,
  ([aberto]) => {
    if (!aberto) return
    if (modoEdicao.value) preencherFormularioEdicao()
    else resetForm()
  },
)

async function onSalvar() {
  if (!podeSalvar.value || submitting.value) return

  submitting.value = true
  try {
    const payload = {
      nome: nome.value.trim(),
      tipo: tipo.value,
    }

    if (modoEdicao.value && props.campo) {
      const atualizado = await camposStore.atualizarCampo(props.workspaceId, props.campo.id, payload)
      toast.success('Campo personalizado atualizado.')
      emit('salvo', atualizado)
    } else {
      const criado = await camposStore.criarCampo(props.workspaceId, payload)
      toast.success('Campo personalizado criado.')
      emit('salvo', criado)
    }

    emit('update:open', false)
  } catch {
    const msg = modoEdicao.value
      ? 'Não foi possível atualizar o campo.'
      : 'Não foi possível criar o campo.'
    toast.error(camposStore.error ?? msg, { duration: 8000 })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <BaseModal
    :open="open"
    :title="tituloModal"
    panel-class="w-full max-w-md"
    @update:open="emit('update:open', $event)"
  >
    <template #subtitle>
      {{
        modoEdicao
          ? 'Altere o nome ou o tipo do campo personalizado.'
          : 'Defina o nome e o tipo do campo para este workspace.'
      }}
    </template>

    <template #icon>
      <span class="material-symbols-outlined text-[22px]" aria-hidden="true">
        {{ modoEdicao ? 'edit' : 'playlist_add' }}
      </span>
    </template>

    <div class="flex flex-col gap-4">
      <div>
        <label
          class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-dark-on-surface"
          for="campo-personalizado-nome"
        >
          Nome
        </label>
        <BaseInput
          id="campo-personalizado-nome"
          v-model="nome"
          type="text"
          placeholder="Ex.: Orçamento"
          :maxlength="200"
          :disabled="submitting"
          autocomplete="off"
        />
      </div>

      <div>
        <label
          class="mb-1.5 block text-sm font-medium text-slate-700 dark:text-dark-on-surface"
          for="campo-personalizado-tipo"
        >
          Tipo
        </label>
        <select
          id="campo-personalizado-tipo"
          v-model="tipo"
          class="w-full rounded-xl border border-outline/40 bg-white px-3 py-2.5 text-sm text-on-surface shadow-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50 dark:border-dark-outline/40 dark:bg-dark-surface-container-low dark:text-dark-on-surface"
          :disabled="submitting"
        >
          <option v-for="opt in TIPOS" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
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
        :disabled="!podeSalvar"
        @click="onSalvar"
      >
        {{
          submitting
            ? modoEdicao
              ? 'Salvando…'
              : 'Criando…'
            : modoEdicao
              ? 'Salvar'
              : 'Criar'
        }}
      </button>
    </template>
  </BaseModal>
</template>
