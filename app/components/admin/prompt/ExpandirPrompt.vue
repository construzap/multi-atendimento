<script setup lang="ts">
import { computed } from 'vue'
import BaseButton from '~/components/BaseButton.vue'

const props = withDefaults(
  defineProps<{
    conteudo: string
    disabled?: boolean
  }>(),
  {
    disabled: false,
  },
)

const emit = defineEmits<{
  'update:conteudo': [value: string]
  recolher: []
}>()

const texto = computed({
  get: () => props.conteudo,
  set: (value: string) => emit('update:conteudo', value),
})
</script>

<template>
  <div class="flex min-h-[min(80vh,48rem)] flex-col gap-2">
    <div class="flex shrink-0 items-center justify-between gap-2">
      <p class="text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
        Área ampliada na própria página para editar textos longos
      </p>
      <BaseButton
        id="btn-expandir-prompt-recolher"
        variant="secondary"
        size="sm"
        :block="false"
        :disabled="disabled"
        @click="emit('recolher')"
      >
        Recolher
      </BaseButton>
    </div>
    <textarea
      id="expandir-prompt-conteudo"
      v-model="texto"
      :disabled="disabled"
      placeholder="Descreva como a IA deve se comportar, regras, tom de voz, contexto do negócio..."
      class="min-h-0 w-full flex-1 resize-none overflow-y-auto rounded-xl border border-outline/40 bg-surface-container-high px-4 py-3 font-mono text-sm leading-relaxed text-on-surface placeholder:text-on-surface-variant/70 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-dark-outline/40 dark:bg-dark-surface-container-high dark:text-dark-on-surface dark:placeholder:text-dark-on-surface-variant/60 dark:focus:ring-primary-900/40"
    />
    <p class="shrink-0 text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
      {{ texto.length }} caracteres
    </p>
  </div>
</template>
