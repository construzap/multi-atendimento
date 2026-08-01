<script setup lang="ts">
import PlanoInicianteCard from '~/components/assinatura/AssinaturaPlanos/PlanoInicianteCard.vue'
import PlanoIntermediarioCard from '~/components/assinatura/AssinaturaPlanos/PlanoIntermediarioCard.vue'
import PlanoAvancadoCard from '~/components/assinatura/AssinaturaPlanos/PlanoAvancadoCard.vue'

definePageMeta({
  layout: 'default'
})
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-6 px-4 py-8 md:px-6">
    <header class="space-y-1">
      <h1 class="font-headline text-2xl font-bold text-on-surface dark:text-dark-on-surface">
        Assinatura — Planos I.A
      </h1>
      <p class="font-body text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
        Escolha um plano e veja a lógica de cobrança. Nenhuma contratação é feita nesta tela.
      </p>
    </header>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <PlanoInicianteCard />
      <PlanoIntermediarioCard />
      <PlanoAvancadoCard />
    </div>
  </div>
</template>
