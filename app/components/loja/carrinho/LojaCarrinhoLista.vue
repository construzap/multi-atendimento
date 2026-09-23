<script setup lang="ts">
import { storeToRefs } from 'pinia'
import LojaCarrinhoItem from '~/components/loja/carrinho/LojaCarrinhoItem.vue'
import { useLojaWorkspaceStore } from '~/stores/loja/workspace'

const loja = useLojaWorkspaceStore()
const router = useRouter()
const { carrinhoAtual, slug } = storeToRefs(loja)

function adicionarMais() {
  const destino = slug.value?.trim()
  if (!destino) return
  void router.push(`/loja/${encodeURIComponent(destino)}`)
}
</script>

<template>
  <section class="px-4">
    <p
      v-if="!carrinhoAtual.length"
      class="py-10 text-center text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
    >
      Sua sacola está vazia.
    </p>

    <LojaCarrinhoItem
      v-for="item in carrinhoAtual"
      :key="item.chave"
      :item="item"
    />

    <button
      type="button"
      class="mx-auto block w-full py-4 text-center text-sm font-semibold text-[#00C853]"
      @click="adicionarMais"
    >
      Adicionar mais itens
    </button>
  </section>
</template>
