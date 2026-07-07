<script setup lang="ts">
definePageMeta({
  layout: 'workspace',
})

const { AreaChat, AreaConversa, AreaInfoConversa, mobilePane } = useChatCanalPage({
  clearConversaOnEnter: true,
  syncConversaToRoute: true,
})
</script>

<template>
  <div class="hidden h-[100dvh] min-h-0 w-full flex-row overflow-hidden md:flex">
    <AreaConversa />
    <AreaChat />
    <AreaInfoConversa />
  </div>

  <div class="flex h-[100dvh] min-h-0 w-full flex-row overflow-hidden md:hidden">
    <AreaConversa v-if="mobilePane === 'list'" />
    <AreaChat v-else-if="mobilePane === 'chat'" />
    <AreaInfoConversa v-else />
  </div>
</template>
