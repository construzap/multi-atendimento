<script setup lang="ts">
import type {
  AtualizarMensagemProntaResponse,
  CriarMensagemProntaResponse,
} from '#shared/types/mensagensProntas'
import ModalCriarMensagemProntaChat from '~/components/chat/area-chat/mensagem-pronta/ModalCriarMensagemPronta.vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    sequenciaId?: string | null
  }>(),
  {
    sequenciaId: null,
  },
)

const emit = defineEmits<{
  'update:open': [value: boolean]
  salvo: [payload: CriarMensagemProntaResponse | AtualizarMensagemProntaResponse]
  close: []
}>()
</script>

<template>
  <ModalCriarMensagemProntaChat
    :open="props.open"
    :sequencia-id="props.sequenciaId"
    @update:open="emit('update:open', $event)"
    @salvo="emit('salvo', $event)"
    @close="emit('close')"
  />
</template>
