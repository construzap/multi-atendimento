<script setup lang="ts">
import { computed, watch } from 'vue'
import LojaPagamentoBotaoRevisar from '~/components/loja/pagamento/LojaPagamentoBotaoRevisar.vue'
import LojaPagamentoHeader from '~/components/loja/pagamento/LojaPagamentoHeader.vue'
import LojaPagamentoNaEntrega from '~/components/loja/pagamento/LojaPagamentoNaEntrega.vue'
import LojaPagamentoOnline from '~/components/loja/pagamento/LojaPagamentoOnline.vue'
import { useLojaWorkspaceStore } from '~/stores/loja/workspace'

definePageMeta({
  layout: false,
})

useHead({
  meta: [
    {
      name: 'viewport',
      content: 'width=device-width, initial-scale=1, viewport-fit=cover',
    },
  ],
})

const route = useRoute()
const loja = useLojaWorkspaceStore()

const slug = computed(() => String(route.params.slug ?? '').trim())

void loja.carregarPorSlug(slug.value)

watch(slug, (novo) => {
  void loja.carregarPorSlug(novo)
})
</script>

<template>
  <div class="min-h-screen bg-surface-container-lowest dark:bg-dark-surface">
    <LojaPagamentoHeader />

    <main class="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-lg flex-col pb-4 md:max-w-2xl">
      <LojaPagamentoOnline />
      <LojaPagamentoNaEntrega />
      <div class="mt-auto">
        <LojaPagamentoBotaoRevisar />
      </div>
    </main>
  </div>
</template>
