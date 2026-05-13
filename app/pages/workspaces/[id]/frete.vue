<script setup lang="ts">
import FreteCapacidadeCaminhao from '~/components/frete/FreteCapacidadeCaminhao.vue'
import FreteFormularioCadastro from '~/components/frete/FreteFormularioCadastro.vue'
import FreteListaRecentes from '~/components/frete/FreteListaRecentes.vue'

definePageMeta({
  layout: 'workspace',
})

</script>

<template>
  <div class="min-h-full bg-background pb-14 pt-6 transition-colors dark:bg-dark-background md:pt-10">
    <div class="mx-auto max-w-4xl space-y-8 px-4 md:space-y-10 md:px-6">
      <header class="max-w-2xl space-y-3">
        <h1 class="font-headline text-3xl font-bold tracking-tight text-on-surface dark:text-dark-on-surface md:text-4xl">
          Frete
        </h1>
        <p class="font-body text-base leading-relaxed text-on-surface dark:text-dark-on-surface md:text-lg">
          Defina a capacidade do caminhão e as taxas por bairro.
        </p>
      </header>

      <FreteCapacidadeCaminhao />
      <FreteFormularioCadastro />
      <FreteListaRecentes />
    </div>
  </div>
</template>
