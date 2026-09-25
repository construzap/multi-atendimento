<script setup lang="ts">
import { computed, onMounted } from 'vue'
import type { LojaPedidoPublico } from '#shared/types/loja'
import LojaPedidoBotaoJaPaguei from '~/components/loja/pedido/LojaPedidoBotaoJaPaguei.vue'

const props = defineProps<{
  pedido: LojaPedidoPublico
}>()

const valor = computed(() =>
  props.pedido.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
)

const url = computed(() => props.pedido.checkoutUrl?.trim() || '')

function irAoAsaas() {
  if (!url.value || !import.meta.client) return
  window.location.href = url.value
}

onMounted(() => {
  if (!url.value || !import.meta.client) return
  const chave = `loja-pedido-redirect:${props.pedido.id}`
  if (sessionStorage.getItem(chave)) return
  sessionStorage.setItem(chave, '1')
  window.setTimeout(() => {
    if (props.pedido.status === 'aguardando' && url.value) {
      window.location.href = url.value
    }
  }, 800)
})
</script>

<template>
  <section class="flex flex-1 flex-col items-center px-4 pt-8 text-center">
    <p class="text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
      Pedido #{{ pedido.id }} · {{ valor }}
    </p>
    <h2 class="mt-2 text-xl font-semibold text-on-surface dark:text-dark-on-surface">
      Pague no Asaas
    </h2>
    <p class="mt-1 max-w-sm text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
      Vamos abrir o checkout seguro do Asaas para você informar o cartão. Depois volte aqui — o status atualiza sozinho.
    </p>

    <button
      type="button"
      class="mt-8 flex h-14 w-full max-w-lg items-center justify-center rounded-full bg-[#00C853] px-5 text-base font-semibold text-white shadow-lg disabled:opacity-60"
      :disabled="!url"
      @click="irAoAsaas"
    >
      {{ url ? 'Ir para o pagamento' : 'Preparando checkout…' }}
    </button>

    <LojaPedidoBotaoJaPaguei :pedido-id="pedido.id" />
  </section>
</template>
