<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import BaseInput from '../../BaseInput.vue'
import { useKanbanConversaCampoEditavel } from './useKanbanConversaCampoEditavel'

const props = defineProps<{
  conversaKey: string
  phone: string | null
  conversaEditavel?: boolean
  nomeEditavel?: boolean
  workspaceId?: number | null
}>()

const emit = defineEmits<{
  telefoneSalvo: [phone: string | null]
}>()

const { podeEditar, aplicarPatch } = useKanbanConversaCampoEditavel({
  conversaKey: () => props.conversaKey,
  conversaEditavel: () => props.conversaEditavel,
  nomeEditavel: () => props.nomeEditavel,
  workspaceId: () => props.workspaceId,
})

const editando = ref(false)
const phoneDraft = ref('')
const salvando = ref(false)

const display = computed(() => props.phone?.trim() || '—')

watch(
  () => props.phone,
  () => {
    if (!editando.value) phoneDraft.value = props.phone?.trim() ?? ''
  },
)

function iniciarEdicao() {
  if (!podeEditar.value) return
  phoneDraft.value = props.phone?.trim() ?? ''
  editando.value = true
}

function cancelarEdicao() {
  editando.value = false
  phoneDraft.value = props.phone?.trim() ?? ''
}

async function salvarTelefone() {
  if (!podeEditar.value || salvando.value) return
  const raw = phoneDraft.value.trim()
  if (!raw) return

  salvando.value = true
  try {
    const atualizado = await aplicarPatch({ phone: raw }, 'Telefone atualizado.')
    emit('telefoneSalvo', atualizado.phone)
    editando.value = false
  } catch {
    /* toast em aplicarPatch */
  } finally {
    salvando.value = false
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    void salvarTelefone()
  }
  if (e.key === 'Escape') {
    e.preventDefault()
    cancelarEdicao()
  }
}
</script>

<template>
  <div class="mt-1 min-w-0">
    <div v-if="editando" class="space-y-2">
      <BaseInput
        v-model="phoneDraft"
        placeholder="5511999999999"
        inputmode="numeric"
        autocomplete="tel"
        :disabled="salvando"
        input-class="font-mono text-xs"
        @keydown="onKeydown"
      />
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="inline-flex items-center gap-1 rounded-lg bg-primary-600 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-primary-700 disabled:opacity-60 dark:bg-primary-500 dark:hover:bg-primary-600"
          :disabled="salvando || !phoneDraft.trim()"
          @click="salvarTelefone"
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
      <p class="min-w-0 flex-1 font-mono text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
        {{ display }}
      </p>
      <button
        v-if="podeEditar"
        type="button"
        class="shrink-0 rounded-lg p-1 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-primary-600 dark:text-dark-on-surface-variant dark:hover:bg-dark-surface-container-high dark:hover:text-primary-400"
        aria-label="Editar telefone"
        @click="iniciarEdicao"
      >
        <span class="material-symbols-outlined text-[16px]" aria-hidden="true">edit</span>
      </button>
    </div>
  </div>
</template>
