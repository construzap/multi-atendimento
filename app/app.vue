<script setup lang="ts">
import { NuxtPage, NuxtRouteAnnouncer } from '#components'
import { Toaster } from 'vue-sonner'
import 'vue-sonner/style.css'
import KanbanPusherAlertaModal from '~/components/kanban/KanbanPusherAlertaModal.vue'

const { isDark, pageBg } = useColorMode()
useAppDocumentTitle()

useHead({
  htmlAttrs: {
    'data-theme': computed(() => (isDark.value ? 'dark' : 'light')),
  },
  meta: [
    {
      name: 'color-scheme',
      content: computed(() => (isDark.value ? 'dark' : 'only light')),
    },
  ],
})
</script>

<template>
  <div
    class="min-h-screen font-body antialiased transition-colors duration-300 selection:bg-primary-700 selection:text-white dark:selection:bg-primary-400/55 dark:selection:text-white"
    :class="isDark ? 'text-dark-on-surface' : 'text-on-surface'"
    :style="{ backgroundColor: pageBg }"
  >
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <KanbanPusherAlertaModal />
    <Toaster
      rich-colors
      position="top-right"
      :theme="isDark ? 'dark' : 'light'"
      class="!z-[200]"
      :toast-options="{ class: '!z-[200]' }"
    />
  </div>
</template>
