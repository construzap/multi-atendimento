<script setup lang="ts">
import AreaChat from '~/components/chat/area-chat.vue'
import AreaConversa from '~/components/chat/area-conversa.vue'
import AreaInfoConversa from '~/components/chat/area-info-conversa.vue'

definePageMeta({
  layout: 'workspace'
})

const route = useRoute()
const raw = route.params.canalId
const canalId = Number.parseInt(String(raw ?? ''), 10)
if (!Number.isFinite(canalId) || canalId < 1 || String(canalId) !== String(raw).trim()) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Canal inválido.'
  })
}

const workspaceId = Number.parseInt(String(route.params.id ?? ''), 10)
const canaisStore = useCanaisStore()

onMounted(async () => {
  if (Number.isFinite(workspaceId)) {
    await canaisStore.fetchCanais(workspaceId).catch(() => {})
  }
  canaisStore.setCurrentCanalId(canalId)
})
</script>

<template>
  <!-- Altura própria: não depende de flex no layout global (evita alterar outras páginas). -->
  <div class="flex min-h-[100dvh] w-full flex-row overflow-hidden">
    <AreaConversa />
    <AreaChat />
    <AreaInfoConversa />
  </div>
</template>
