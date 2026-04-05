<script setup lang="ts">
import { computed } from 'vue'
import BaseButton from '~/components/BaseButton.vue'
import BaseModal from '~/components/BaseModal.vue'

type Variante = 'aviso' | 'perigo' | 'info'

const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    /** Texto principal do alerta */
    texto: string
    variante?: Variante
    textoConfirmar?: string
    textoCancelar?: string
    mostrarCancelar?: boolean
    /** Se true, o botão X do header não aparece (só Cancelar/Confirmar) */
    mostrarFechar?: boolean
    /** Desabilita o botão principal (ex.: durante request) */
    confirmarDesabilitado?: boolean
    cancelarDesabilitado?: boolean
  }>(),
  {
    variante: 'aviso',
    textoConfirmar: 'Confirmar',
    textoCancelar: 'Cancelar',
    mostrarCancelar: true,
    mostrarFechar: true,
    confirmarDesabilitado: false,
    cancelarDesabilitado: false
  }
)

const emit = defineEmits<{
  'update:open': [value: boolean]
  confirmar: []
  cancelar: []
}>()

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v)
})

const iconWrapClass = computed(() => {
  if (props.variante === 'perigo') {
    return 'bg-danger-container/80 text-danger dark:bg-danger-container/40'
  }
  if (props.variante === 'info') {
    return 'bg-info-container text-info-on-container'
  }
  return 'bg-warning-container text-warning-on-container'
})

function fechar() {
  isOpen.value = false
  emit('cancelar')
}

function onConfirmar() {
  emit('confirmar')
}

function onCancelar() {
  fechar()
}
</script>

<template>
  <BaseModal v-model:open="isOpen" :title="title" :show-close="mostrarFechar" @close="emit('cancelar')">
    <template #icon>
      <div
        class="flex h-10 w-10 items-center justify-center rounded-xl"
        :class="iconWrapClass"
        aria-hidden="true"
      >
        <svg v-if="variante === 'info'" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 16v-4M12 8h.01" stroke-linecap="round" />
        </svg>
        <svg v-else class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke-linejoin="round" />
          <path d="M12 9v4M12 17h.01" stroke-linecap="round" />
        </svg>
      </div>
    </template>

    <p class="font-body text-sm leading-relaxed text-on-surface-variant dark:text-dark-on-surface-variant">
      {{ texto }}
    </p>

    <template #footer>
      <div v-if="mostrarCancelar" class="w-full sm:w-40">
        <BaseButton type="button" variant="secondary" :disabled="cancelarDesabilitado" @click="onCancelar">
          {{ textoCancelar }}
        </BaseButton>
      </div>
      <div class="w-full sm:w-44">
        <BaseButton type="button" :disabled="confirmarDesabilitado" @click="onConfirmar">
          {{ textoConfirmar }}
        </BaseButton>
      </div>
    </template>
  </BaseModal>
</template>
