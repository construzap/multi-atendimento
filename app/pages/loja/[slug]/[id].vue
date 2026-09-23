<script setup lang="ts">
import { computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import LojaCarregando from '~/components/loja/pagina-inicial/LojaCarregando.vue'
import LojaBotoesAcao from '~/components/loja/pagina-produto-unico/LojaBotoesAcao.vue'
import LojaGaleriaFotos from '~/components/loja/pagina-produto-unico/LojaGaleriaFotos.vue'
import LojaInformacoesProduto from '~/components/loja/pagina-produto-unico/LojaInformacoesProduto.vue'
import LojaObservacoes from '~/components/loja/pagina-produto-unico/LojaObservacoes.vue'
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
const router = useRouter()
const loja = useLojaWorkspaceStore()
const { erro, carregado, aguardando, paginaProdutoUnico, slug: slugStore } = storeToRefs(loja)

const slug = computed(() => String(route.params.slug ?? '').trim())
const produtoId = computed(() => {
  const n = Number.parseInt(String(route.params.id ?? ''), 10)
  return Number.isFinite(n) && n > 0 ? n : null
})

const produtoNaoEncontrado = computed(
  () =>
    carregado.value &&
    produtoId.value != null &&
    paginaProdutoUnico.value?.id !== produtoId.value,
)

async function garantirProduto() {
  if (slugStore.value !== slug.value || !carregado.value) {
    await loja.carregarPorSlug(slug.value)
  }
  if (produtoId.value != null) {
    loja.abrirProdutoUnicoPorId(produtoId.value)
  }
}

function voltar() {
  loja.fecharProdutoUnico()
  void router.push(`/loja/${encodeURIComponent(slug.value)}`)
}

void garantirProduto()

watch([slug, produtoId], () => {
  void garantirProduto()
})
</script>

<template>
  <div class="min-h-screen bg-surface-container-lowest pb-[env(safe-area-inset-bottom,0px)] dark:bg-dark-surface">
    <LojaHeader />

    <LojaCarregando v-if="aguardando && !paginaProdutoUnico" />

    <template v-else-if="paginaProdutoUnico && paginaProdutoUnico.id === produtoId">
      <div class="relative">
        <button
          type="button"
          class="absolute left-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-lowest/90 text-on-surface shadow-sm dark:bg-dark-surface-container-low/90 dark:text-dark-on-surface"
          aria-label="Voltar"
          @click="voltar"
        >
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 18l-6-6 6-6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        <LojaGaleriaFotos />
      </div>
      <LojaInformacoesProduto />
      <LojaObservacoes />
      <LojaBotoesAcao />
    </template>

    <main
      v-else
      class="mx-auto flex max-w-lg flex-col items-center gap-3 px-4 py-16 text-center"
    >
      <p class="text-base font-medium text-on-surface dark:text-dark-on-surface">
        {{
          produtoNaoEncontrado
            ? 'Produto não encontrado.'
            : erro || 'Loja não encontrada.'
        }}
      </p>
      <button
        type="button"
        class="mt-2 text-sm font-medium text-primary-600 dark:text-dark-primary"
        @click="voltar"
      >
        Voltar para a loja
      </button>
    </main>
  </div>
</template>
