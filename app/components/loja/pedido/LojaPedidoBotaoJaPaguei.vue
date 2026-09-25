<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useLojaWorkspaceStore } from '~/stores/loja/workspace'

const props = defineProps<{
  pedidoId: number
}>()

const loja = useLojaWorkspaceStore()
const router = useRouter()
const { slug } = storeToRefs(loja)

function jaPaguei() {
  const destino = slug.value?.trim()
  if (!destino || props.pedidoId < 1) return
  void router.push(`/loja/${encodeURIComponent(destino)}/confirmando?id=${props.pedidoId}`)
}
</script>

<template>
  <button
    type="button"
    class="mt-3 flex h-14 w-full max-w-lg items-center justify-center rounded-full border border-[#00C853] px-5 text-base font-semibold text-[#00C853]"
    @click="jaPaguei"
  >
    Já paguei
  </button>
</template>
