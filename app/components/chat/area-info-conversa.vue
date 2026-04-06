<script setup lang="ts">
/**
 * Painel à direita — contexto do cliente, campos e anotações internas.
 */
import InfoConversaCamposPersonalizados from '~/components/chat/area-info-conversa/InfoConversaCamposPersonalizados.vue'
import InfoConversaHeader from '~/components/chat/area-info-conversa/InfoConversaHeader.vue'
import InfoConversaNovaAnotacao from '~/components/chat/area-info-conversa/InfoConversaNovaAnotacao.vue'
import ListaAnotacoes from '~/components/chat/area-info-conversa/ListaAnotacoes.vue'
</script>

<template>
  <div
    class="flex min-h-0 w-full min-w-0 shrink-0 flex-col border-l border-slate-200/80 bg-white dark:border-slate-700/80 dark:bg-slate-950 md:w-80"
  >
    <InfoConversaHeader />

    <div class="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
      <InfoConversaCamposPersonalizados />
      <ListaAnotacoes />
    </div>

    <InfoConversaNovaAnotacao />
  </div>
</template>
