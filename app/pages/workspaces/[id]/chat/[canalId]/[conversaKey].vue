<script setup lang="ts">
/**
 * Compat: bookmarks `/chat/:canalId/:conversaKey`.
 * Seleciona no Pinia e redireciona para `/chat/:canalId` (sem key na URL).
 */
import { abrirConversaNoChat } from '~/composables/useConversasRouteSync'
import { parsePositiveIntParam } from '~/utils/chatRouteParams'

definePageMeta({
  layout: 'workspace',
})

const route = useRoute()

const workspaceId = parsePositiveIntParam(route.params.id)
const canalId = parsePositiveIntParam(route.params.canalId)
const rawKey = String(route.params.conversaKey ?? '').trim()
let conversaKey = rawKey
try {
  conversaKey = decodeURIComponent(rawKey).trim()
} catch {
  /* keep raw */
}

if (workspaceId && canalId && conversaKey) {
  await abrirConversaNoChat(workspaceId, canalId, conversaKey, { replace: true })
} else if (workspaceId && canalId) {
  await navigateTo(`/workspaces/${workspaceId}/chat/${canalId}`, { replace: true })
} else if (workspaceId) {
  await navigateTo(`/workspaces/${workspaceId}/chat`, { replace: true })
} else {
  await navigateTo('/', { replace: true })
}
</script>

<template>
  <div class="flex h-[100dvh] items-center justify-center text-sm text-slate-500">
    Abrindo conversa…
  </div>
</template>
