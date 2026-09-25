<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import type { LojaPedidoPublico } from '#shared/types/loja'
import { useLojaWorkspaceStore } from '~/stores/loja/workspace'

const props = defineProps<{
  pedido: LojaPedidoPublico
}>()

const loja = useLojaWorkspaceStore()
const router = useRouter()
const { slug } = storeToRefs(loja)

const valor = computed(() =>
  props.pedido.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
)

function voltarLoja() {
  const destino = slug.value?.trim()
  if (destino) {
    void router.push(`/loja/${encodeURIComponent(destino)}`)
    return
  }
  void router.push('/loja')
}
</script>

<template>
  <section class="flex flex-1 flex-col items-center px-4 pt-16 text-center">
    <div class="flex h-16 w-16 items-center justify-center rounded-full bg-[#00C853]/15 text-[#00C853]">
      <svg class="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
        <path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </div>
    <h2 class="mt-5 text-xl font-semibold text-on-surface dark:text-dark-on-surface">
      Pagamento confirmado
    </h2>
    <p class="mt-2 max-w-sm text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
      Pedido #{{ pedido.id }} · {{ valor }}. A loja já recebeu o seu pedido.
    </p>
    <button
      type="button"
      class="mt-8 flex h-14 w-full max-w-lg items-center justify-center rounded-full bg-[#00C853] px-5 text-base font-semibold text-white shadow-lg"
      @click="voltarLoja"
    >
      Voltar à loja
    </button>
  </section>
</template>
