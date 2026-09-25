<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useLojaWorkspaceStore } from '~/stores/loja/workspace'

const loja = useLojaWorkspaceStore()
const router = useRouter()
const { slug, pedidoAtual } = storeToRefs(loja)

function voltar() {
  const destino = slug.value?.trim()
  const id = pedidoAtual.value?.id
  if (pedidoAtual.value?.status === 'pago' && destino) {
    void router.push(`/loja/${encodeURIComponent(destino)}`)
    return
  }
  if (destino && id) {
    void router.push(`/loja/${encodeURIComponent(destino)}/pedido?id=${id}`)
    return
  }
  if (destino) {
    void router.push(`/loja/${encodeURIComponent(destino)}/pedido`)
    return
  }
  void router.back()
}
</script>

<template>
  <header
    class="sticky top-0 z-30 border-b border-outline/20 bg-surface-container-lowest/95 pt-[env(safe-area-inset-top)] backdrop-blur dark:border-dark-outline/20 dark:bg-dark-surface/95"
  >
    <div class="mx-auto flex h-14 max-w-lg items-center px-3 md:max-w-2xl">
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
      <h1 class="flex-1 pr-10 text-center text-base font-medium text-on-surface dark:text-dark-on-surface">
        Confirmando
      </h1>
    </div>
  </header>
</template>
