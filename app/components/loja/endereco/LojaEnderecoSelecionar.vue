<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import LojaEnderecoModalNovo from '~/components/loja/endereco/LojaEnderecoModalNovo.vue'
import LojaLoginModal from '~/components/loja/login/LojaLoginModal.vue'
import { useLojaWorkspaceStore } from '~/stores/loja/workspace'

const loja = useLojaWorkspaceStore()
const { loginPronto } = storeToRefs(loja)

const modalEndereco = ref(false)
const modalLogin = ref(false)

function adicionarEndereco() {
  if (loginPronto.value) {
    modalEndereco.value = true
    return
  }
  modalLogin.value = true
}

function onLoginSucesso() {
  modalLogin.value = false
  modalEndereco.value = true
}

function onLoginOpen(aberto: boolean) {
  modalLogin.value = aberto
}
</script>

<template>
  <section class="px-4 pt-6">
    <p class="mb-3 text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
      Selecione o endereço de entrega
    </p>
    <button
      type="button"
      class="flex h-12 w-full items-center justify-center gap-2 rounded-full border border-[#00C853] text-sm font-semibold text-[#00C853]"
      @click="adicionarEndereco"
    >
      <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
        <path d="M12 21s7-5.4 7-11a7 7 0 10-14 0c0 5.6 7 11 7 11z" stroke-linejoin="round" />
        <circle cx="12" cy="10" r="2.2" />
      </svg>
      Adicionar novo endereço
    </button>

    <LojaLoginModal :open="modalLogin" @update:open="onLoginOpen" @sucesso="onLoginSucesso" />
    <LojaEnderecoModalNovo v-model:open="modalEndereco" />
  </section>
</template>
