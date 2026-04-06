<script setup lang="ts">
import AreaChatCorpoMensagens from '~/components/chat/area-chat/AreaChatCorpoMensagens.vue'
import AreaChatHeader from '~/components/chat/area-chat/AreaChatHeader.vue'
import AreaChatRodape from '~/components/chat/area-chat/AreaChatRodape.vue'
</script>

<template>
  <div class="relative flex min-h-0 min-w-0 flex-1 flex-col">
    <AreaChatHeader />
    <AreaChatCorpoMensagens />
    <AreaChatRodape />
  </div>
</template>
