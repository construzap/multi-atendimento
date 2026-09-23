<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useLojaWorkspaceStore } from '~/stores/loja/workspace'

const loja = useLojaWorkspaceStore()
const { paginaProdutoUnico } = storeToRefs(loja)

const fotos = computed(() => {
  const url = paginaProdutoUnico.value?.imagem_url?.trim()
  return url ? [url] : []
})

const nome = computed(() => paginaProdutoUnico.value?.nome ?? 'Produto')
</script>

<template>
  <section class="overflow-hidden bg-surface-container dark:bg-dark-surface-container">
    <div
      v-if="fotos.length"
      class="aspect-square w-full"
    >
      <img
        :src="fotos[0]"
        :alt="nome"
        class="h-full w-full object-cover"
      />
    </div>
    <div
      v-else
      class="flex aspect-square w-full items-center justify-center text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
    >
      Sem foto
    </div>
  </section>
</template>
