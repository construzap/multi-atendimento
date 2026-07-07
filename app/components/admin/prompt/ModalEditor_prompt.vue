<script setup lang="ts">
import { ref, watch } from 'vue'
import BaseButton from '~/components/BaseButton.vue'
import BaseModal from '~/components/BaseModal.vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    conteudo: string
    disabled?: boolean
  }>(),
  {
    disabled: false,
  },
)

const emit = defineEmits<{
  'update:open': [value: boolean]
  'update:conteudo': [value: string]
}>()

const rascunho = ref('')

watch(
  () => [props.open, props.conteudo] as const,
  ([aberto, texto]) => {
    if (aberto) rascunho.value = texto
  },
  { immediate: true },
)

function fechar() {
  emit('update:open', false)
}

function aplicar() {
  emit('update:conteudo', rascunho.value)
  fechar()
}
</script>

<template>
  <BaseModal
    :open="open"
    title="Editar conteúdo do prompt"
    panel-class="flex w-full max-w-5xl max-h-[min(92vh,52rem)] flex-col"
    @update:open="emit('update:open', $event)"
  >
    <template #subtitle>
      Área ampliada para editar textos longos com mais conforto
    </template>

    <div class="flex min-h-0 flex-1 flex-col gap-2">
      <textarea
        id="modal-editor-prompt-conteudo"
        v-model="rascunho"
        :disabled="disabled"
        placeholder="Descreva como a IA deve se comportar, regras, tom de voz, contexto do negócio..."
        class="min-h-[min(60vh,28rem)] w-full flex-1 resize-none overflow-y-auto rounded-xl border border-outline/40 bg-surface-container-high px-4 py-3 font-mono text-sm leading-relaxed text-on-surface placeholder:text-on-surface-variant/70 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-dark-outline/40 dark:bg-dark-surface-container-high dark:text-dark-on-surface dark:placeholder:text-dark-on-surface-variant/60 dark:focus:ring-primary-900/40"
        rows="20"
      />
      <p class="text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
        {{ rascunho.length }} caracteres
      </p>
    </div>

    <template #footer>
      <BaseButton
        id="btn-modal-editor-prompt-cancelar"
        variant="secondary"
        size="sm"
        :block="false"
        :disabled="disabled"
        @click="fechar"
      >
        Cancelar
      </BaseButton>
      <BaseButton
        id="btn-modal-editor-prompt-aplicar"
        variant="primary"
        size="sm"
        :block="false"
        :disabled="disabled"
        @click="aplicar"
      >
        Aplicar alterações
      </BaseButton>
    </template>
  </BaseModal>
</template>
