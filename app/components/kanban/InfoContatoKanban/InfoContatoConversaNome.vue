<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import BaseInput from '../../BaseInput.vue'
import { useKanbanConversaCampoEditavel } from './useKanbanConversaCampoEditavel'

const props = defineProps<{
  conversaKey: string
  name: string | null
  phone: string | null
  conversaEditavel?: boolean
  nomeEditavel?: boolean
  workspaceId?: number | null
}>()

const emit = defineEmits<{
  nomeSalvo: [name: string | null]
}>()

const { podeEditar, aplicarPatch } = useKanbanConversaCampoEditavel({
  conversaKey: () => props.conversaKey,
  conversaEditavel: () => props.conversaEditavel,
  nomeEditavel: () => props.nomeEditavel,
  workspaceId: () => props.workspaceId,
})

const editando = ref(false)
const nomeDraft = ref('')
const salvando = ref(false)

const titleDisplay = computed(() => {
  const n = props.name?.trim()
  if (n) return n
  const ph = props.phone?.trim()
  if (ph) return ph
  return props.conversaKey
})

watch(
  () => props.name,
  () => {
    if (!editando.value) nomeDraft.value = props.name?.trim() ?? ''
  },
)

function iniciarEdicao() {
  if (!podeEditar.value) return
  nomeDraft.value = props.name?.trim() ?? ''
  editando.value = true
}

function cancelarEdicao() {
  editando.value = false
  nomeDraft.value = props.name?.trim() ?? ''
}

async function salvarNome() {
  if (!podeEditar.value || salvando.value) return

  salvando.value = true
  try {
    const novoNome = nomeDraft.value.trim() || null
    const atualizado = await aplicarPatch({ name: novoNome }, 'Nome atualizado.')
    emit('nomeSalvo', atualizado.name)
    editando.value = false
  } catch {
    /* toast em aplicarPatch */
  } finally {
    salvando.value = false
  }
}

function onKeydownNome(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    void salvarNome()
  }
  if (e.key === 'Escape') {
    e.preventDefault()
    cancelarEdicao()
  }
}
</script>

<template>
  <div class="min-w-0 flex-1">
    <div v-if="editando" class="space-y-2">
      <BaseInput
        v-model="nomeDraft"
        placeholder="Nome do contato"
        autocomplete="name"
        :disabled="salvando"
        input-class="text-sm font-semibold"
        @keydown="onKeydownNome"
      />
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="inline-flex items-center gap-1 rounded-lg bg-primary-600 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-primary-700 disabled:opacity-60 dark:bg-primary-500 dark:hover:bg-primary-600"
          :disabled="salvando"
          @click="salvarNome"
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

    <div v-else class="flex min-w-0 items-start gap-1">
      <h3 class="min-w-0 flex-1 font-headline text-base font-bold text-on-surface dark:text-dark-on-surface">
        {{ titleDisplay }}
      </h3>
      <button
        v-if="podeEditar"
        type="button"
        class="mt-0.5 shrink-0 rounded-lg p-1 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-primary-600 dark:text-dark-on-surface-variant dark:hover:bg-dark-surface-container-high dark:hover:text-primary-400"
        aria-label="Editar nome"
        @click="iniciarEdicao"
      >
        <span class="material-symbols-outlined text-[18px]" aria-hidden="true">edit</span>
      </button>
    </div>
  </div>
</template>
