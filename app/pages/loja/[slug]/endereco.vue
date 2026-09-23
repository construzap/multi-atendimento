<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import LojaEnderecoBotaoContinuar from '~/components/loja/endereco/LojaEnderecoBotaoContinuar.vue'
import LojaEnderecoHeader from '~/components/loja/endereco/LojaEnderecoHeader.vue'
import LojaEnderecoLista from '~/components/loja/endereco/LojaEnderecoLista.vue'
import LojaEnderecoModoRecebimento from '~/components/loja/endereco/LojaEnderecoModoRecebimento.vue'
import LojaEnderecoRetirada from '~/components/loja/endereco/LojaEnderecoRetirada.vue'
import LojaEnderecoSelecionar from '~/components/loja/endereco/LojaEnderecoSelecionar.vue'
import LojaLoginModal from '~/components/loja/login/LojaLoginModal.vue'
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
const loja = useLojaWorkspaceStore()
const { modoRecebimento, canal, buscou, loginPronto } = storeToRefs(loja)

const slug = computed(() => String(route.params.slug ?? '').trim())
const loginAberto = ref(false)

void loja.carregarPorSlug(slug.value)

watch(slug, (novo) => {
  void loja.carregarPorSlug(novo)
})

watch(
  [loginPronto, () => canal.value?.id, buscou],
  ([pronto, canalId, jaBuscou]) => {
    if (!jaBuscou || !canalId) return
    if (!pronto) {
      loginAberto.value = true
      return
    }
    loginAberto.value = false
    void loja.carregarEnderecos()
  },
  { immediate: true },
)

function onLoginOpen(aberto: boolean) {
  if (!aberto && !loja.loginPronto) return
  loginAberto.value = aberto
  if (!aberto && loja.loginPronto) void loja.carregarEnderecos()
}
</script>

<template>
  <div class="min-h-screen bg-surface-container-lowest dark:bg-dark-surface">
    <LojaEnderecoHeader />

    <main class="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-lg flex-col md:max-w-2xl">
      <LojaEnderecoModoRecebimento />

      <template v-if="modoRecebimento === 'entrega'">
        <LojaEnderecoSelecionar />
        <LojaEnderecoLista />
      </template>
      <LojaEnderecoRetirada v-else />

      <div class="mt-auto">
        <LojaEnderecoBotaoContinuar />
      </div>
    </main>

    <LojaLoginModal :open="loginAberto" @update:open="onLoginOpen" />
  </div>
</template>
