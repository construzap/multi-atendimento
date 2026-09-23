<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useLojaWorkspaceStore } from '~/stores/loja/workspace'

const loja = useLojaWorkspaceStore()
const router = useRouter()
const { slug, carrinhoAtual } = storeToRefs(loja)

const podeLimpar = computed(() => carrinhoAtual.value.length > 0)

function voltar() {
  const destino = slug.value?.trim()
  if (destino) {
    void router.push(`/loja/${encodeURIComponent(destino)}`)
    return
  }
  void router.back()
}

function limpar() {
  if (!podeLimpar.value) return
  loja.limparCarrinho()
}
</script>

<template>
  <header
    class="sticky top-0 z-30 border-b border-outline/20 bg-surface-container-lowest/95 pt-[env(safe-area-inset-top)] backdrop-blur dark:border-dark-outline/20 dark:bg-dark-surface/95"
  >
    <div class="mx-auto flex h-14 max-w-lg items-center justify-between px-3 md:max-w-2xl">
      <button
        type="button"
        class="flex h-10 w-10 items-center justify-center rounded-full text-on-surface dark:text-dark-on-surface"
        aria-label="Voltar"
        @click="voltar"
      >
        <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M15 18l-6-6 6-6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>

      <h1 class="text-base font-medium text-on-surface dark:text-dark-on-surface">
        Sua sacola
      </h1>

      <button
        type="button"
        class="min-w-10 px-1 text-sm text-on-surface-variant disabled:opacity-40 dark:text-dark-on-surface-variant"
        :disabled="!podeLimpar"
        @click="limpar"
      >
        Limpar
      </button>
    </div>
  </header>
</template>
