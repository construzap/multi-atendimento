<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import LojaConfirmandoHeader from '~/components/loja/confirmando/LojaConfirmandoHeader.vue'
import LojaConfirmandoStatus from '~/components/loja/confirmando/LojaConfirmandoStatus.vue'
import LojaLoginModal from '~/components/loja/login/LojaLoginModal.vue'
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

const MAX_TENTATIVAS = 10

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
const erro = ref('')
const tentativas = ref(0)
const esgotou = ref(false)
const verificando = ref(false)
let pollTimer: ReturnType<typeof setInterval> | null = null
let cicloIniciado = false

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
    if (!cicloIniciado) {
      cicloIniciado = true
      void iniciarCiclo()
    }
  },
  { immediate: true },
)

function onLoginOpen(aberto: boolean) {
  if (!aberto && !loja.loginPronto) return
  loginAberto.value = aberto
  if (!aberto && loja.loginPronto && !cicloIniciado) {
    cicloIniciado = true
    void iniciarCiclo()
  }
}

function iniciarCiclo() {
  tentativas.value = 0
  esgotou.value = false
  erro.value = ''
  pararPoll()
  void verificarPedido()
}

async function verificarPedido() {
  if (!loja.loginPronto || verificando.value || esgotou.value) return
  const id = pedidoId.value
  if (id == null) {
    const destino = slug.value || slugStore.value
    if (destino) void router.replace(`/loja/${encodeURIComponent(destino)}/pedido`)
    return
  }

  if (tentativas.value >= MAX_TENTATIVAS) {
    pararPoll()
    esgotou.value = true
    return
  }

  tentativas.value += 1
  verificando.value = true
  erro.value = ''
  try {
    await loja.consultarPedido(id)
    if (loja.pedidoAtual?.status === 'pago') {
      pararPoll()
      return
    }
    if (loja.pedidoAtual?.status === 'expirado') {
      pararPoll()
      const destino = slug.value || slugStore.value
      if (destino) {
        void router.replace(`/loja/${encodeURIComponent(destino)}/pedido?id=${id}`)
      }
      return
    }
    if (tentativas.value >= MAX_TENTATIVAS) {
      pararPoll()
      esgotou.value = true
      return
    }
    iniciarPoll()
  } catch (err) {
    erro.value = mensagemErroLoja(err, 'Ainda não confirmamos o pagamento.')
    if (tentativas.value >= MAX_TENTATIVAS) {
      pararPoll()
      esgotou.value = true
    } else {
      iniciarPoll()
    }
  } finally {
    verificando.value = false
  }
}

function iniciarPoll() {
  if (pollTimer || !import.meta.client) return
  pollTimer = setInterval(() => {
    if (document.visibilityState === 'hidden') return
    pararPoll()
    void verificarPedido()
  }, 3000)
}

function pararPoll() {
  if (!pollTimer) return
  clearInterval(pollTimer)
  pollTimer = null
}

onMounted(() => {
  loja.hidratarPedido(slug.value)
})

onUnmounted(() => {
  pararPoll()
})
</script>

<template>
  <div class="min-h-screen bg-surface-container-lowest dark:bg-dark-surface">
    <LojaConfirmandoHeader />

    <main class="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-lg flex-col pb-8 md:max-w-2xl">
      <LojaPedidoSucesso
        v-if="pedidoAtual?.status === 'pago'"
        :pedido="pedidoAtual"
      />
      <LojaConfirmandoStatus
        v-else
        :tentativas="tentativas"
        :maximo="MAX_TENTATIVAS"
        :esgotou="esgotou"
        :erro="erro"
        @verificar-novamente="iniciarCiclo"
      />
    </main>

    <LojaLoginModal :open="loginAberto" @update:open="onLoginOpen" />
  </div>
</template>
