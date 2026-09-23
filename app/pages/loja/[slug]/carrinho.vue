<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import LojaCarrinhoBotaoContinuar from '~/components/loja/carrinho/LojaCarrinhoBotaoContinuar.vue'
import LojaCarrinhoCodigoCupom from '~/components/loja/carrinho/LojaCarrinhoCodigoCupom.vue'
import LojaCarrinhoHeader from '~/components/loja/carrinho/LojaCarrinhoHeader.vue'
import LojaCarrinhoLista from '~/components/loja/carrinho/LojaCarrinhoLista.vue'
import LojaCarrinhoObservacoes from '~/components/loja/carrinho/LojaCarrinhoObservacoes.vue'
import LojaCarrinhoValores from '~/components/loja/carrinho/LojaCarrinhoValores.vue'
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

onMounted(() => {
  loja.hidratarCarrinho(slug.value)
})

watch(slug, (novo) => {
  void loja.carregarPorSlug(novo)
})
</script>

<template>
  <div class="min-h-screen bg-surface-container-lowest dark:bg-dark-surface">
    <LojaCarrinhoHeader />

    <main class="mx-auto max-w-lg pb-4 md:max-w-2xl">
      <LojaCarrinhoLista />
      <LojaCarrinhoCodigoCupom />
      <LojaCarrinhoValores />
      <LojaCarrinhoObservacoes />
      <LojaCarrinhoBotaoContinuar />
    </main>
  </div>
</template>
