<script setup lang="ts">
import ColorModeToggle from '~/components/ColorModeToggle.vue'
import { NuxtPage, NuxtRouteAnnouncer } from '#components'
import { Toaster } from 'vue-sonner'
import 'vue-sonner/style.css'

const { isDark } = useColorMode()
</script>

<template>
  <div
    class="min-h-screen bg-background font-body text-on-surface antialiased transition-colors duration-500 ease-out-expo selection:bg-primary-container/30 dark:bg-dark-background dark:text-dark-on-surface dark:selection:bg-dark-primary-container/40"
  >
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <Toaster
      rich-colors
      position="top-right"
      :theme="isDark ? 'dark' : 'light'"
      class="!z-[200]"
      :toast-options="{ class: '!z-[200]' }"
    />
    <ColorModeToggle />
  </div>
</template>
