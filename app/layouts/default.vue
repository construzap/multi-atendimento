<script setup lang="ts">
import AppHeader from '~/components/layout/AppHeader.vue'
</script>

<template>
  <div class="min-h-screen bg-background transition-colors dark:bg-dark-background">
    <AppHeader />
    <slot />
  </div>
</template>
