<script setup lang="ts">
import PerfilUsuarioForm from '~/components/perfil/PerfilUsuarioForm.vue'
import PerfilAlterarSenhaForm from '~/components/perfil/PerfilAlterarSenhaForm.vue'

definePageMeta({
  layout: 'default'
})
</script>

<template>
  <div class="mx-auto max-w-4xl space-y-6 px-4 py-8 md:px-6">
    <header class="space-y-1">
      <h1 class="font-headline text-2xl font-bold text-on-surface dark:text-dark-on-surface">
        Meu Perfil
      </h1>
      <p class="font-body text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
        Gerencie suas informações pessoais e segurança
      </p>
    </header>

    <PerfilUsuarioForm />
    <PerfilAlterarSenhaForm />
  </div>
</template>
