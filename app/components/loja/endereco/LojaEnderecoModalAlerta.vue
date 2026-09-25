<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    open: boolean
    titulo?: string
    texto?: string
    textoConfirmar?: string
    textoCancelar?: string
    confirmando?: boolean
  }>(),
  {
    titulo: 'Apagar endereço',
    texto: 'Tem certeza que deseja apagar este endereço? Essa ação não pode ser desfeita.',
    textoConfirmar: 'Apagar',
    textoCancelar: 'Cancelar',
    confirmando: false,
  },
)

const emit = defineEmits<{
  'update:open': [value: boolean]
  confirmar: []
  cancelar: []
}>()

function fechar() {
  if (props.confirmando) return
  emit('update:open', false)
  emit('cancelar')
}

function confirmar() {
  if (props.confirmando) return
  emit('confirmar')
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      :aria-label="titulo"
      @click.self="fechar"
    >
      <section
        class="w-full max-w-sm rounded-3xl bg-surface-container-lowest px-5 py-5 dark:bg-dark-surface"
      >
        <h2 class="text-lg font-semibold text-on-surface dark:text-dark-on-surface">
          {{ titulo }}
        </h2>
        <p class="mt-2 text-sm leading-relaxed text-on-surface-variant dark:text-dark-on-surface-variant">
          {{ texto }}
        </p>

        <div class="mt-5 flex flex-col gap-2">
          <button
            type="button"
            class="flex h-12 items-center justify-center rounded-full bg-red-500 text-sm font-semibold text-white disabled:opacity-60"
            :disabled="confirmando"
            @click="confirmar"
          >
            {{ confirmando ? 'Apagando…' : textoConfirmar }}
          </button>
          <button
            type="button"
            class="flex h-12 items-center justify-center rounded-full border border-outline/30 text-sm font-medium text-on-surface disabled:opacity-60 dark:border-dark-outline/30 dark:text-dark-on-surface"
            :disabled="confirmando"
            @click="fechar"
          >
            {{ textoCancelar }}
          </button>
        </div>
      </section>
    </div>
  </Teleport>
</template>
