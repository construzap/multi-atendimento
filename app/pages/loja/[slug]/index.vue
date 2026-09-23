<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import LojaBotaoVerSacola from '~/components/loja/carrinho/LojaBotaoVerSacola.vue'
import LojaCarregando from '~/components/loja/pagina-inicial/LojaCarregando.vue'
import LojaGradeProdutos from '~/components/loja/pagina-inicial/LojaGradeProdutos.vue'
import LojaHeader from '~/components/loja/LojaHeader.vue'
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
const slug = computed(() => String(route.params.slug ?? '').trim())

const loja = useLojaWorkspaceStore()
const { erro, carregado, aguardando, nome } = storeToRefs(loja)

loja.fecharProdutoUnico()
void loja.carregarPorSlug(slug.value)

onMounted(() => {
  loja.hidratarCarrinho(slug.value)
})

watch(slug, (novo) => {
  loja.fecharProdutoUnico()
  void loja.carregarPorSlug(novo)
})
</script>

<template>
  <div class="min-h-screen bg-surface-container-lowest pb-[env(safe-area-inset-bottom,0px)] dark:bg-dark-surface">
    <LojaHeader />

    <LojaCarregando v-if="aguardando" />

    <template v-else-if="carregado">
      <LojaGradeProdutos :nome-loja="nome" />
      <LojaBotaoVerSacola />
    </template>

    <main
      v-else
      class="mx-auto flex max-w-lg flex-col items-center gap-3 px-4 py-16 text-center"
    >
      <p class="text-base font-medium text-on-surface dark:text-dark-on-surface">
        {{ erro || 'Loja não encontrada.' }}
      </p>
      <p class="text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
        Confira o link ou peça o endereço completo ao estabelecimento, por exemplo
        <span class="font-mono text-on-surface dark:text-dark-on-surface">/loja/nome-da-loja</span>.
      </p>
    </main>
  </div>
</template>
