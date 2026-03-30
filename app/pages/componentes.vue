<script setup lang="ts">
import { ref } from 'vue'
import { NuxtLink } from '#components'
import BaseButton from '~/components/BaseButton.vue'
import BaseInput from '~/components/BaseInput.vue'

const texto = ref('')
</script>

<template>
  <main
    class="mx-auto max-w-lg space-y-8 px-4 py-8 transition-colors duration-500 ease-out-expo md:py-12"
  >
    <header class="space-y-2">
      <NuxtLink
        id="link-componentes-home"
        to="/"
        class="font-label text-sm text-primary underline-offset-4 hover:underline dark:text-dark-primary"
      >
        Voltar ao início
      </NuxtLink>
      <h1 class="font-headline text-2xl font-bold text-on-surface dark:text-dark-on-surface">
        Componentes base
      </h1>
      <p class="font-body text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
        BaseInput e BaseButton — estilos de referência para o app.
      </p>
    </header>

    <section class="space-y-4">
      <h2 class="font-label text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
        BaseInput
      </h2>
      <BaseInput v-model="texto" wrapper-id="base-input-demo" placeholder="Digite algo…">
        <template #leading>
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" stroke-linecap="round" />
          </svg>
        </template>
      </BaseInput>
      <p class="font-body text-xs text-on-surface-variant">v-model: {{ texto || '(vazio)' }}</p>
    </section>

    <section class="space-y-4">
      <h2 class="font-label text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
        BaseButton
      </h2>
      <BaseButton>Continuar</BaseButton>
    </section>
  </main>
</template>
