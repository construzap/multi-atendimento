<script setup lang="ts">
import LojaHeader from '~/components/loja/LojaHeader.vue'

definePageMeta({
  layout: false,
})
</script>

<template>
  <div class="min-h-screen bg-surface dark:bg-dark-surface">
    <LojaHeader titulo="Loja" />

    <main class="mx-auto flex max-w-lg flex-col items-center gap-3 px-4 py-16 text-center">
      <p class="text-base font-medium text-on-surface dark:text-dark-on-surface">
        Acesse o link de uma loja
      </p>
      <p class="text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
        Esta página precisa do endereço completo da loja, por exemplo
        <span class="font-mono text-on-surface dark:text-dark-on-surface">/loja/nome-da-loja</span>.
        Peça o link ao estabelecimento.
      </p>
    </main>
  </div>
</template>
