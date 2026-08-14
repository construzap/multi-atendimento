<script setup lang="ts">
import AppHeader from '~/components/layout/AppHeader.vue'

const { pageBg } = useColorMode()
</script>

<template>
  <div class="min-h-screen transition-colors" :style="{ backgroundColor: pageBg }">
    <AppHeader />
    <slot />
  </div>
</template>
