<script setup lang="ts">
import { computed, watch } from 'vue'
import LojaEnviadoConteudo from '~/components/loja/enviado/LojaEnviadoConteudo.vue'
import LojaEnviadoHeader from '~/components/loja/enviado/LojaEnviadoHeader.vue'
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
const slug = computed(() => String(route.params.slug ?? '').trim())

void loja.carregarPorSlug(slug.value)

watch(slug, (novo) => {
  void loja.carregarPorSlug(novo)
})
</script>

<template>
  <div class="min-h-screen bg-surface-container-lowest dark:bg-dark-surface">
    <LojaEnviadoHeader />
    <main class="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-lg flex-col pb-8 md:max-w-2xl">
      <LojaEnviadoConteudo />
    </main>
  </div>
</template>
