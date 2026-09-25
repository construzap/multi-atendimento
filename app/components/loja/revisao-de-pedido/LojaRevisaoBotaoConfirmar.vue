<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { mensagemErroLoja, useLojaWorkspaceStore } from '~/stores/loja/workspace'

const emit = defineEmits<{
  'precisa-login': []
}>()

const loja = useLojaWorkspaceStore()
const router = useRouter()
const { carrinhoAtual, formaPagamento, modoRecebimento, enderecoSelecionadoId, slug, loginPronto, pedidoLoading } =
  storeToRefs(loja)

const erro = ref('')

const formaOnline = computed(() => {
  const f = formaPagamento.value
  return f === 'pix' || f === 'credito_online'
})

const podeConfirmar = computed(() => {
  if (!carrinhoAtual.value.length || !formaOnline.value || pedidoLoading.value) return false
  if (modoRecebimento.value === 'entrega') return enderecoSelecionadoId.value != null
  return true
})

async function confirmar() {
  erro.value = ''
  if (!loginPronto.value) {
    emit('precisa-login')
    return
  }
  if (!podeConfirmar.value) {
    if (!formaOnline.value) {
      erro.value = 'Pagamento na entrega ainda não está disponível. Use PIX ou cartão online.'
    }
    return
  }

  try {
    const pedido = await loja.criarPedido()
    const destino = slug.value?.trim()
    if (!destino) return
    await router.push(`/loja/${encodeURIComponent(destino)}/pedido?id=${pedido.id}`)
  } catch (err) {
    erro.value = loja.pedidoErro || mensagemErroLoja(err, 'Não foi possível confirmar o pedido.')
  }
}
</script>

<template>
  <div
    class="pointer-events-none sticky bottom-0 z-30 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] pt-4"
  >
    <p
      v-if="erro"
      class="pointer-events-auto mx-auto mb-3 max-w-lg text-center text-sm text-red-600 md:max-w-2xl"
    >
      {{ erro }}
    </p>
    <button
      type="button"
      class="pointer-events-auto mx-auto flex h-14 w-full max-w-lg items-center justify-center rounded-full px-5 text-base font-semibold shadow-lg md:max-w-2xl"
      :class="
        podeConfirmar
          ? 'bg-[#00C853] text-white'
          : 'bg-surface-container text-on-surface-variant dark:bg-dark-surface-container dark:text-dark-on-surface-variant'
      "
      :disabled="!podeConfirmar && loginPronto"
      @click="confirmar"
    >
      {{ pedidoLoading ? 'Gerando pagamento…' : 'Confirmar pedido' }}
    </button>
  </div>
</template>
