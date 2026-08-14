<script setup lang="ts">
import WorkspacesGrid from '~/components/workspaces/WorkspacesGrid.vue'

definePageMeta({
  layout: 'default'
})
</script>

<template>
  <div class="min-h-full bg-white dark:bg-dark-background">
    <WorkspacesGrid />
  </div>
</template>
