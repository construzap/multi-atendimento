<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import BaseButton from '~/components/BaseButton.vue'
import BaseInput from '~/components/BaseInput.vue'
import BaseModal from '~/components/BaseModal.vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    paiNome: string
    salvando?: boolean
  }>(),
  { salvando: false },
)

const emit = defineEmits<{
  'update:open': [value: boolean]
  salvar: [nome: string]
}>()

const nome = ref('')
const inputRef = ref<InstanceType<typeof BaseInput> | null>(null)

watch(
  () => props.open,
  async (aberto) => {
    if (!aberto) {
      nome.value = ''
      return
    }
    nome.value = ''
    await nextTick()
    const el = inputRef.value?.$el as HTMLElement | undefined
    const inp = el?.querySelector('input') ?? (el instanceof HTMLInputElement ? el : null)
    inp?.focus()
  },
)

function fechar() {
  if (props.salvando) return
  emit('update:open', false)
}

function confirmar() {
  if (props.salvando) return
  const t = nome.value.trim()
  if (!t) return
  emit('salvar', t)
}

function onKeydown(ev: KeyboardEvent) {
  if (ev.key === 'Enter') {
    ev.preventDefault()
    confirmar()
  }
}
</script>

<template>
  <BaseModal
    :open="open"
    title="Nova variação"
    panel-class="w-full max-w-md"
    @update:open="emit('update:open', $event)"
    @close="fechar"
  >
    <div class="space-y-4">
      <p class="text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
        Variação de
        <span class="font-semibold text-on-surface dark:text-dark-on-surface">«{{ paiNome }}»</span>
      </p>

      <div>
        <label class="mb-1.5 block text-xs font-medium uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
          Nome da variação
        </label>
        <BaseInput
          ref="inputRef"
          v-model="nome"
          autocomplete="off"
          placeholder="Ex.: Tamanho G · Cor Azul"
          :disabled="salvando"
          @keydown="onKeydown"
        />
      </div>

      <div class="flex justify-end gap-2 pt-1">
        <BaseButton :block="false" variant="secondary" size="sm" :disabled="salvando" @click="fechar">
          Cancelar
        </BaseButton>
        <BaseButton
          :block="false"
          variant="primary"
          size="sm"
          :disabled="salvando || !nome.trim()"
          @click="confirmar"
        >
          {{ salvando ? 'A guardar…' : 'Salvar' }}
        </BaseButton>
      </div>
    </div>
  </BaseModal>
</template>
