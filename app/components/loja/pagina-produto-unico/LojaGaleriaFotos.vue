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
      class="mx-auto aspect-square w-full max-h-[70vh] md:aspect-auto md:h-[28rem] md:max-h-[min(28rem,55vh)] md:max-w-3xl"
    >
      <img
        :src="fotos[0]"
        :alt="nome"
        class="h-full w-full object-cover md:object-contain"
      />
    </div>
    <div
      v-else
      class="mx-auto flex aspect-square w-full max-h-[70vh] items-center justify-center text-sm text-on-surface-variant dark:text-dark-on-surface-variant md:aspect-auto md:h-[28rem] md:max-h-[min(28rem,55vh)] md:max-w-3xl"
    >
      Sem foto
    </div>
  </section>
</template>
