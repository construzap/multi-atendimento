<script setup lang="ts">
import PerfilUsuarioForm from '~/components/perfil/PerfilUsuarioForm.vue'
import PerfilAlterarSenhaForm from '~/components/perfil/PerfilAlterarSenhaForm.vue'
</script>

<template>
  <div class="min-h-screen bg-background transition-colors dark:bg-dark-background">
    <header
      class="border-b border-outline/40 bg-surface-container-lowest px-6 py-5 transition-colors dark:border-dark-outline/40 dark:bg-dark-surface-container-low md:px-8"
    >
      <div class="mx-auto flex max-w-4xl flex-wrap items-start justify-between gap-4">
        <div>
          <h1 class="font-headline text-2xl font-bold text-on-surface dark:text-dark-on-surface">
            Meu Perfil
          </h1>
          <p class="mt-1 font-body text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
            Gerencie suas informações pessoais e segurança
          </p>
        </div>
        <div class="flex items-center gap-2">
          <NuxtLink
            to="/"
            class="rounded-xl border border-outline bg-surface-container px-4 py-2 font-label text-sm font-medium text-primary-600 shadow-sm transition-colors hover:bg-surface-container-high dark:border-dark-outline dark:bg-dark-surface-container dark:text-dark-primary dark:hover:bg-dark-surface-container-high"
          >
            Voltar ao início
          </NuxtLink>
        </div>
      </div>
    </header>

    <div class="mx-auto max-w-4xl space-y-6 px-4 py-8 md:px-6">
      <PerfilUsuarioForm />
      <PerfilAlterarSenhaForm />
    </div>
  </div>
</template>
