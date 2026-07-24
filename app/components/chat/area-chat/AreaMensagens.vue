<script setup lang="ts">
import { storeToRefs } from 'pinia'
import AreaChatCorpoMensagens from '~/components/chat/area-chat/AreaChatCorpoMensagens.vue'
import AreaChatHeader from '~/components/chat/area-chat/AreaChatHeader.vue'
import AreaChatRodape from '~/components/chat/area-chat/AreaChatRodape.vue'
import AreaChatSemConversaSelecionada from '~/components/chat/area-chat/AreaChatSemConversaSelecionada.vue'

const { conversaKeyAtiva } = useConversaKeyAtiva()
const mensagensStore = useMensagensStore()
const { carregandoConversaAtiva } = storeToRefs(mensagensStore)
</script>

<template>
  <div class="relative flex min-h-0 min-w-0 flex-1 flex-col">
    <template v-if="conversaKeyAtiva">
      <AreaChatHeader />
      <div class="relative flex min-h-0 flex-1 flex-col">
        <AreaChatCorpoMensagens />
        <Transition name="msg-loading">
          <div
            v-if="carregandoConversaAtiva"
            class="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-surface/80 backdrop-blur-[2px] dark:bg-dark-surface/80"
            role="status"
            aria-live="polite"
            aria-label="Carregando mensagens"
          >
            <span
              class="material-symbols-outlined animate-spin text-4xl text-primary-600 dark:text-primary-400"
              aria-hidden="true"
            >
              progress_activity
            </span>
            <p class="text-sm font-medium text-on-surface-variant dark:text-dark-on-surface-variant">
              Carregando mensagens…
            </p>
          </div>
        </Transition>
      </div>
      <AreaChatRodape />
    </template>
    <AreaChatSemConversaSelecionada v-else />
  </div>
</template>

<style scoped>
.msg-loading-enter-active,
.msg-loading-leave-active {
  transition: opacity 0.18s ease;
}
.msg-loading-enter-from,
.msg-loading-leave-to {
  opacity: 0;
}
</style>
