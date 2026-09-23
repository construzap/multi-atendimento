<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useLojaWorkspaceStore } from '~/stores/loja/workspace'

const loja = useLojaWorkspaceStore()
const router = useRouter()
const { carrinhoTotal, slug } = storeToRefs(loja)

function abrirSacola() {
  const destino = slug.value?.trim()
  if (!destino) return
  void router.push(`/loja/${encodeURIComponent(destino)}/carrinho`)
}

const totalFormatado = computed(() =>
  carrinhoTotal.value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }),
)
</script>

<template>
  <div
    class="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]"
  >
    <button
      type="button"
      class="pointer-events-auto mx-auto flex h-14 w-full max-w-lg items-center justify-between rounded-full bg-[#00C853] px-5 text-white shadow-lg md:max-w-2xl"
      @click="abrirSacola"
    >
      <span class="flex min-w-0 items-center gap-3">
        <svg class="h-6 w-6 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M6 8h12l-1 12H7L6 8z" stroke-linejoin="round" />
          <path d="M9 8V7a3 3 0 016 0v1" stroke-linecap="round" />
        </svg>
        <span class="truncate text-base font-semibold">Ver sacola</span>
      </span>
      <span class="shrink-0 text-base font-semibold">{{ totalFormatado }}</span>
    </button>
  </div>
</template>
