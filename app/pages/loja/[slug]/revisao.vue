<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import LojaLoginModal from '~/components/loja/login/LojaLoginModal.vue'
import LojaRevisaoBotaoConfirmar from '~/components/loja/revisao-de-pedido/LojaRevisaoBotaoConfirmar.vue'
import LojaRevisaoHeader from '~/components/loja/revisao-de-pedido/LojaRevisaoHeader.vue'
import LojaRevisaoItens from '~/components/loja/revisao-de-pedido/LojaRevisaoItens.vue'
import LojaRevisaoObservacao from '~/components/loja/revisao-de-pedido/LojaRevisaoObservacao.vue'
import LojaRevisaoPagamento from '~/components/loja/revisao-de-pedido/LojaRevisaoPagamento.vue'
import LojaRevisaoRecebimento from '~/components/loja/revisao-de-pedido/LojaRevisaoRecebimento.vue'
import LojaRevisaoValores from '~/components/loja/revisao-de-pedido/LojaRevisaoValores.vue'
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
const router = useRouter()
const loja = useLojaWorkspaceStore()
const { loginPronto, buscou, canal } = storeToRefs(loja)

const slug = computed(() => String(route.params.slug ?? '').trim())
const loginAberto = ref(false)

void loja.carregarPorSlug(slug.value)

watch(slug, (novo) => {
  void loja.carregarPorSlug(novo)
})

watch(
  () => [loja.buscou, loja.formaPagamento, loja.carrinhoAtual.length] as const,
  ([buscou, forma, qtd]) => {
    if (!buscou) return
    const destino = slug.value
    if (!destino) return
    if (!forma || !qtd) {
      void router.replace(`/loja/${encodeURIComponent(destino)}/pagamento`)
    }
  },
  { immediate: true },
)

watch(
  [loginPronto, () => canal.value?.id, buscou],
  ([pronto, canalId, jaBuscou]) => {
    if (!jaBuscou || !canalId) return
    if (!pronto) loginAberto.value = true
  },
  { immediate: true },
)

function onLoginOpen(aberto: boolean) {
  if (!aberto && !loja.loginPronto) return
  loginAberto.value = aberto
}
</script>

<template>
  <div class="min-h-screen bg-surface-container-lowest dark:bg-dark-surface">
    <LojaRevisaoHeader />

    <main class="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-lg flex-col pb-4 md:max-w-2xl">
      <LojaRevisaoItens />
      <LojaRevisaoObservacao />
      <LojaRevisaoRecebimento />
      <LojaRevisaoPagamento />
      <LojaRevisaoValores />
      <div class="mt-auto">
        <LojaRevisaoBotaoConfirmar @precisa-login="loginAberto = true" />
      </div>
    </main>

    <LojaLoginModal :open="loginAberto" @update:open="onLoginOpen" />
  </div>
</template>
