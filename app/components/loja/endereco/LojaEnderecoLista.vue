<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import type { LojaEndereco } from '#shared/types/loja'
import LojaEnderecoItem from '~/components/loja/endereco/LojaEnderecoItem.vue'
import LojaEnderecoModalAlerta from '~/components/loja/endereco/LojaEnderecoModalAlerta.vue'
import LojaEnderecoModalNovo from '~/components/loja/endereco/LojaEnderecoModalNovo.vue'
import { useLojaWorkspaceStore } from '~/stores/loja/workspace'

const loja = useLojaWorkspaceStore()
const { enderecos, enderecoSelecionadoId, enderecosLoading } = storeToRefs(loja)

const modalAberto = ref(false)
const enderecoEditando = ref<LojaEndereco | null>(null)

const alertaAberto = ref(false)
const enderecoApagando = ref<LojaEndereco | null>(null)
const apagando = ref(false)

function abrirEdicao(endereco: LojaEndereco) {
  enderecoEditando.value = endereco
  modalAberto.value = true
}

function onModalOpen(aberto: boolean) {
  modalAberto.value = aberto
  if (!aberto) enderecoEditando.value = null
}

function pedirApagar(endereco: LojaEndereco) {
  enderecoApagando.value = endereco
  alertaAberto.value = true
}

function fecharAlerta(aberto: boolean) {
  alertaAberto.value = aberto
  if (!aberto && !apagando.value) enderecoApagando.value = null
}

async function confirmarApagar() {
  const id = enderecoApagando.value?.id
  if (id == null || apagando.value) return
  apagando.value = true
  try {
    await loja.apagarEndereco(id)
    alertaAberto.value = false
    enderecoApagando.value = null
  } finally {
    apagando.value = false
  }
}
</script>

<template>
  <section class="flex flex-col gap-3 px-4 pt-4">
    <p
      v-if="enderecosLoading"
      class="py-6 text-center text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
    >
      Carregando endereços…
    </p>
    <p
      v-else-if="!enderecos.length"
      class="py-6 text-center text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
    >
      Nenhum endereço cadastrado.
    </p>
    <LojaEnderecoItem
      v-for="endereco in enderecos"
      :key="endereco.id"
      :endereco="endereco"
      :selecionado="enderecoSelecionadoId === endereco.id"
      @editar="abrirEdicao"
      @apagar="pedirApagar"
    />

    <LojaEnderecoModalNovo
      :open="modalAberto"
      :endereco="enderecoEditando"
      @update:open="onModalOpen"
    />

    <LojaEnderecoModalAlerta
      :open="alertaAberto"
      :confirmando="apagando"
      @update:open="fecharAlerta"
      @confirmar="confirmarApagar"
    />
  </section>
</template>
