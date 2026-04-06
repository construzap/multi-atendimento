<script setup lang="ts">
/**
 * Área central do chat (mensagens ativas).
 * Composição: `area-chat/AreaMensagens.vue` e subcomponentes.
 */
import AreaMensagens from '~/components/chat/area-chat/AreaMensagens.vue'
</script>

<template>
  <div
    class="relative flex min-h-0 min-w-0 flex-1 flex-col bg-[#e5ddd5] dark:bg-[#0b141a]"
  >
    <div
      class="pointer-events-none absolute inset-0 opacity-[0.06] dark:opacity-[0.12]"
      style="
        background-image: url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23000000\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E');
      "
      aria-hidden="true"
    />
    <div class="relative z-[1] flex min-h-0 min-w-0 flex-1 flex-col">
      <AreaMensagens />
    </div>
  </div>
</template>
