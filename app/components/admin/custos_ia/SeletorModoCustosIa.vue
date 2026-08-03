<script setup lang="ts">
import type { AdminCustosIaModo } from '~/stores/adminCustosIa'

const props = defineProps<{
  modelValue: AdminCustosIaModo
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: AdminCustosIaModo]
}>()

const opcoes: { id: AdminCustosIaModo; label: string }[] = [
  { id: 'custos', label: 'Custo total' },
  { id: 'erros', label: 'Erros' },
]

function selecionar(modo: AdminCustosIaModo) {
  if (props.disabled || props.modelValue === modo) return
  emit('update:modelValue', modo)
}
</script>

<template>
  <div
    class="inline-flex rounded-xl border border-outline/40 bg-surface-container-high p-1 dark:border-dark-outline/40 dark:bg-dark-surface-container-high"
    role="tablist"
    aria-label="Modo de visualização"
  >
    <button
      v-for="opcao in opcoes"
      :key="opcao.id"
      type="button"
      role="tab"
      :aria-selected="modelValue === opcao.id"
      :disabled="disabled"
      class="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      :class="
        modelValue === opcao.id
          ? 'bg-surface-container-lowest text-on-surface shadow-sm dark:bg-dark-surface-container-low dark:text-dark-on-surface'
          : 'text-on-surface-variant hover:text-on-surface dark:text-dark-on-surface-variant dark:hover:text-dark-on-surface'
      "
      @click="selecionar(opcao.id)"
    >
      {{ opcao.label }}
    </button>
  </div>
</template>
