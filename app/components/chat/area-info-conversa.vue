<script setup lang="ts">
/**
 * Painel à direita — contexto do cliente, campos e anotações internas.
 * Desktop: recolhe/expande com botão lateral.
 */
import InfoConversaCamposPersonalizados from '~/components/chat/area-info-conversa/InfoConversaCamposPersonalizados.vue'
import InfoConversaDados from '~/components/chat/area-info-conversa/InfoConversaDados.vue'
import InfoConversaHeader from '~/components/chat/area-info-conversa/InfoConversaHeader.vue'
import InfoConversaNovaAnotacao from '~/components/chat/area-info-conversa/InfoConversaNovaAnotacao.vue'
import ListaAnotacoes from '~/components/chat/area-info-conversa/ListaAnotacoes.vue'

const conversasStore = useConversasStore()
const aberto = useState('chat_info_panel_aberto', () => false)

const temConversaSelecionada = computed(() => Boolean(conversasStore.conversaAtual?.trim()))

function togglePainel() {
  aberto.value = !aberto.value
}
</script>

<template>
  <div v-if="temConversaSelecionada" class="flex min-h-0 w-full min-w-0 shrink-0 self-stretch md:w-auto">
    <!-- Botão lateral (só desktop) -->
    <button
      type="button"
      class="hidden shrink-0 items-center justify-center self-stretch border-l border-slate-200/80 bg-slate-50 text-slate-500 transition hover:bg-slate-100 active:scale-[0.98] dark:border-slate-700/80 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 md:flex md:w-5"
      :aria-expanded="aberto"
      :aria-label="aberto ? 'Recolher painel de informações' : 'Abrir painel de informações'"
      @click="togglePainel"
    >
      <span class="material-symbols-outlined text-[18px]" aria-hidden="true">
        {{ aberto ? 'chevron_right' : 'chevron_left' }}
      </span>
    </button>

    <!-- Painel recolhível (mobile sempre aberto em tela cheia) -->
    <div
      class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-l border-slate-200/80 bg-white transition-[width] duration-300 ease-in-out dark:border-slate-700/80 dark:bg-slate-950 md:flex-none"
      :class="aberto ? 'md:w-80' : 'md:w-0 md:border-l-0'"
      :aria-hidden="!aberto"
    >
      <div class="flex h-full min-h-0 w-full flex-col md:w-80">
        <InfoConversaHeader />

        <div class="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <InfoConversaDados />
          <InfoConversaCamposPersonalizados />
          <ListaAnotacoes />
        </div>

        <InfoConversaNovaAnotacao />
      </div>
    </div>
  </div>
</template>
