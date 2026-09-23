<script setup lang="ts">
import { storeToRefs } from 'pinia'
import LojaEnderecoItem from '~/components/loja/endereco/LojaEnderecoItem.vue'
import { useLojaWorkspaceStore } from '~/stores/loja/workspace'

const loja = useLojaWorkspaceStore()
const { enderecos, enderecoSelecionadoId, enderecosLoading } = storeToRefs(loja)
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
    />
  </section>
</template>
