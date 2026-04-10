<script setup lang="ts">
import AreaChatCorpoMensagens from '~/components/chat/area-chat/AreaChatCorpoMensagens.vue'
import AreaChatHeader from '~/components/chat/area-chat/AreaChatHeader.vue'
import AreaChatRodape from '~/components/chat/area-chat/AreaChatRodape.vue'
import AreaChatSemConversaSelecionada from '~/components/chat/area-chat/AreaChatSemConversaSelecionada.vue'

const conversasStore = useConversasStore()
const { conversaAtual } = storeToRefs(conversasStore)
</script>

<template>
  <div class="relative flex min-h-0 min-w-0 flex-1 flex-col">
    <template v-if="conversaAtual">
      <AreaChatHeader />
      <AreaChatCorpoMensagens />
      <AreaChatRodape />
    </template>
    <AreaChatSemConversaSelecionada v-else />
  </div>
</template>
