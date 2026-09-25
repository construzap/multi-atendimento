<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import LojaLoginModal from '~/components/loja/login/LojaLoginModal.vue'
import LojaPedidoCartao from '~/components/loja/pedido/LojaPedidoCartao.vue'
import LojaPedidoHeader from '~/components/loja/pedido/LojaPedidoHeader.vue'
import LojaPedidoPix from '~/components/loja/pedido/LojaPedidoPix.vue'
import LojaPedidoSucesso from '~/components/loja/pedido/LojaPedidoSucesso.vue'
import { mensagemErroLoja, useLojaWorkspaceStore } from '~/stores/loja/workspace'

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
const { slug: slugStore, loginPronto, pedidoAtual, buscou, canal } = storeToRefs(loja)

const slug = computed(() => String(route.params.slug ?? '').trim())
const pedidoId = computed(() => {
  const q = Number.parseInt(String(route.query.id ?? ''), 10)
  if (Number.isFinite(q) && q > 0) return q
  return loja.pedidoAtual?.id ?? null
})

const loginAberto = ref(false)
const carregando = ref(false)
const erro = ref('')

void loja.carregarPorSlug(slug.value)

watch(slug, (novo) => {
  void loja.carregarPorSlug(novo)
})

watch(
  [loginPronto, () => canal.value?.id, buscou],
  ([pronto, canalId, jaBuscou]) => {
    if (!jaBuscou || !canalId) return
    if (!pronto) {
      loginAberto.value = true
      return
    }
    loginAberto.value = false
    void atualizarPedido()
  },
  { immediate: true },
)

onMounted(() => {
  loja.hidratarPedido(slug.value)
  useLojaPedidoPusher(pedidoId, () => {
    void atualizarPedido()
  })
})

function onLoginOpen(aberto: boolean) {
  if (!aberto && !loja.loginPronto) return
  loginAberto.value = aberto
  if (!aberto && loja.loginPronto) void atualizarPedido()
}

async function atualizarPedido() {
  if (!loja.loginPronto) return
  const id = pedidoId.value
  if (id == null) {
    const destino = slug.value || slugStore.value
    if (destino) void router.replace(`/loja/${encodeURIComponent(destino)}/revisao`)
    return
  }

  carregando.value = !pedidoAtual.value
  erro.value = ''
  try {
    await loja.consultarPedido(id)
  } catch (err) {
    if (!loja.pedidoAtual) {
      erro.value = mensagemErroLoja(err, 'Não foi possível consultar o pedido.')
    }
  } finally {
    carregando.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-surface-container-lowest dark:bg-dark-surface">
    <LojaPedidoHeader />

    <main class="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-lg flex-col pb-8 md:max-w-2xl">
      <p
        v-if="erro"
        class="px-4 pt-6 text-center text-sm text-red-600"
      >
        {{ erro }}
      </p>
      <p
        v-else-if="carregando && !pedidoAtual"
        class="px-4 pt-16 text-center text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
      >
        Carregando pagamento…
      </p>

      <LojaPedidoSucesso
        v-else-if="pedidoAtual?.status === 'pago'"
        :pedido="pedidoAtual"
      />
      <LojaPedidoPix
        v-else-if="pedidoAtual?.forma === 'pix'"
        :pedido="pedidoAtual"
        @expirou="atualizarPedido"
      />
      <LojaPedidoCartao
        v-else-if="pedidoAtual?.forma === 'credito_online'"
        :pedido="pedidoAtual"
      />
    </main>

    <LojaLoginModal :open="loginAberto" @update:open="onLoginOpen" />
  </div>
</template>
