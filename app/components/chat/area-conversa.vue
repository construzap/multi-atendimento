<script setup lang="ts">
import AreaConversaHeader from '~/components/chat/area-conversa/AreaConversaHeader.vue'
import FiltroKanban from '~/components/chat/area-conversa/FiltroKanban.vue'
import ListaConversas from '~/components/chat/area-conversa/ListaConversas.vue'
</script>

<template>
  <div
    class="flex min-h-0 min-w-0 flex-1 flex-col border-r border-slate-200/80 bg-slate-100/90 dark:border-slate-700/80 dark:bg-slate-900/50 md:max-w-md md:flex-none"
    style="min-width: 18rem"
  >
    <AreaConversaHeader />
    <FiltroKanban />
    <ListaConversas />
  </div>
</template>
