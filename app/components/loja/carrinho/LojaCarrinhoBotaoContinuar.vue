<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useLojaWorkspaceStore } from '~/stores/loja/workspace'

const loja = useLojaWorkspaceStore()
const router = useRouter()
const { carrinhoAtual, slug } = storeToRefs(loja)

const desabilitado = computed(() => carrinhoAtual.value.length === 0)

function continuar() {
  const destino = slug.value?.trim()
  if (!destino || desabilitado.value) return
  void router.push(`/loja/${encodeURIComponent(destino)}/endereco`)
}
</script>

<template>
  <div
    class="pointer-events-none sticky bottom-0 z-30 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] pt-2"
  >
    <button
      type="button"
      class="pointer-events-auto mx-auto flex h-14 w-full max-w-lg items-center justify-center rounded-full bg-[#00C853] px-5 text-base font-semibold text-white shadow-lg disabled:opacity-40 md:max-w-2xl"
      :disabled="desabilitado"
      @click="continuar"
    >
      Continuar para endereço
    </button>
  </div>
</template>
