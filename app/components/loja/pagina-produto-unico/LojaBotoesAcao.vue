<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useLojaWorkspaceStore } from '~/stores/loja/workspace'

const loja = useLojaWorkspaceStore()
const router = useRouter()
const { paginaProdutoUnico, observacaoProdutoUnico, slug } = storeToRefs(loja)

const quantidade = ref(1)

const precoUnitario = computed(() => {
  const p = paginaProdutoUnico.value
  if (!p) return null
  if (p.preco_promocional != null && Number.isFinite(p.preco_promocional)) return p.preco_promocional
  return p.preco
})

const total = computed(() => {
  if (precoUnitario.value == null) return null
  return precoUnitario.value * quantidade.value
})

function formatPreco(valor: number): string {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function menos() {
  if (quantidade.value <= 1) return
  quantidade.value -= 1
}

function mais() {
  quantidade.value += 1
}

function adicionar() {
  const produto = paginaProdutoUnico.value
  if (!produto || precoUnitario.value == null) return
  loja.adicionarAoCarrinho({
    produto,
    quantidade: quantidade.value,
    observacao: observacaoProdutoUnico.value,
    precoUnitario: precoUnitario.value,
  })
  const destino = slug.value?.trim()
  if (destino) {
    void router.push(`/loja/${encodeURIComponent(destino)}`)
  }
}

watch(
  () => paginaProdutoUnico.value?.id,
  () => {
    quantidade.value = 1
  },
)
</script>

<template>
  <section
    v-if="paginaProdutoUnico"
    class="sticky bottom-0 border-t border-outline/30 bg-surface-container-lowest/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] dark:border-dark-outline/30 dark:bg-dark-surface-container-low/95"
  >
    <div class="mx-auto flex max-w-lg items-center gap-3 md:max-w-2xl">
      <div class="flex shrink-0 items-center overflow-hidden rounded-full bg-surface-container dark:bg-dark-surface-container">
        <button
          type="button"
          class="flex h-11 w-11 items-center justify-center text-lg font-medium text-on-surface disabled:opacity-40 dark:text-dark-on-surface"
          :disabled="quantidade <= 1"
          aria-label="Diminuir quantidade"
          @click="menos"
        >
          −
        </button>
        <span class="min-w-8 text-center text-base font-semibold text-on-surface dark:text-dark-on-surface">
          {{ quantidade }}
        </span>
        <button
          type="button"
          class="flex h-11 w-11 items-center justify-center text-lg font-medium text-on-surface dark:text-dark-on-surface"
          aria-label="Aumentar quantidade"
          @click="mais"
        >
          +
        </button>
      </div>

      <button
        type="button"
        class="flex h-12 min-w-0 flex-1 items-center justify-center rounded-full bg-primary-600 px-4 text-sm font-semibold text-white"
        @click="adicionar"
      >
        <span>Adicionar</span>
        <span v-if="total != null" class="ml-2">{{ formatPreco(total) }}</span>
      </button>
    </div>
  </section>
</template>
