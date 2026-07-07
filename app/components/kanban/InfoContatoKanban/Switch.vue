<script setup lang="ts">
import { computed, ref } from 'vue'
import type { KanbanConversaPatch } from '#shared/types/kanban'
import { useKanbanConversaCampoEditavel } from './useKanbanConversaCampoEditavel'

const props = defineProps<{
  conversaKey: string
  campo: keyof Pick<KanbanConversaPatch, 'conversa_aberta' | 'ia_ligada' | 'is_group'>
  label: string
  valor: boolean | null
  conversaEditavel?: boolean
  nomeEditavel?: boolean
  workspaceId?: number | null
  mensagemSucesso?: string
}>()

const emit = defineEmits<{
  alterado: [valor: boolean]
}>()

const { podeEditar, aplicarPatch } = useKanbanConversaCampoEditavel({
  conversaKey: () => props.conversaKey,
  conversaEditavel: () => props.conversaEditavel,
  nomeEditavel: () => props.nomeEditavel,
  workspaceId: () => props.workspaceId,
})
const salvando = ref(false)

const marcado = computed(() => props.valor === true)

const textoEstado = computed(() => {
  if (props.valor === true) return 'Sim'
  if (props.valor === false) return 'Não'
  return '—'
})

async function onToggle() {
  if (!podeEditar.value || salvando.value) return

  const novoValor = !marcado.value
  salvando.value = true
  try {
    await aplicarPatch(
      { [props.campo]: novoValor },
      props.mensagemSucesso ?? `${props.label} atualizado.`,
    )
    emit('alterado', novoValor)
  } catch {
    /* toast em aplicarPatch */
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-0.5">
    <dt class="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
      {{ label }}
    </dt>
    <dd class="text-sm font-medium text-on-surface dark:text-dark-on-surface">
      <label
        v-if="podeEditar"
        class="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-outline/30 px-3 py-2 text-sm transition-colors hover:bg-surface-container-high dark:border-dark-outline/30 dark:hover:bg-dark-surface-container-high/60"
        :class="salvando ? 'pointer-events-none opacity-60' : ''"
      >
        <input
          type="checkbox"
          class="h-4 w-4 rounded border-outline/50"
          :checked="marcado"
          :disabled="salvando"
          @change="onToggle"
        />
        <span>{{ marcado ? 'Sim' : 'Não' }}</span>
      </label>
      <span v-else>{{ textoEstado }}</span>
    </dd>
  </div>
</template>
