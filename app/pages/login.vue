<script setup lang="ts">
import { NuxtLink } from '#components'
import LoginLeftSection from '~/components/login/LoginLeftSection.vue'
import LoginRightSection from '~/components/login/LoginRightSection.vue'

definePageMeta({
  middleware: ['guest']
})
</script>

<template>
  <div class="flex min-h-screen flex-col bg-background md:flex-row">
    <LoginLeftSection />
    <div class="relative flex flex-1 flex-col">
      <NuxtLink
        id="link-login-home"
        to="/"
        class="absolute right-4 top-4 z-10 font-label text-sm font-medium text-primary-600 hover:text-primary-700 md:right-6 md:top-6"
      >
        Voltar ao início
      </NuxtLink>
      <LoginRightSection />
    </div>
  </div>
</template>
