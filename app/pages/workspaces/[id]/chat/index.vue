<script setup lang="ts">
import type { Canal } from '#shared/types/canal'

definePageMeta({
  layout: 'workspace'
})

const route = useRoute()
const workspaceId = computed(() => String(route.params.id ?? ''))

const { data: canais, pending } = await useAsyncData(
  () => `chat-index-canais-${workspaceId.value}`,
  () => {
    const wid = workspaceId.value
    if (!wid) return Promise.resolve([] as Canal[])
    return $fetch<Canal[]>('/api/canais', { query: { workspace_id: wid } })
  },
  { watch: [workspaceId] }
)

watch(
  canais,
  (list) => {
    if (list && list.length > 0) {
      navigateTo(`/workspaces/${workspaceId.value}/chat/${list[0]!.id}`, { replace: true })
    }
  },
  { immediate: true }
)
</script>

<template>
  <div class="flex min-h-[100dvh] items-center justify-center p-6">
    <div v-if="pending" class="text-sm text-on-surface-variant dark:text-slate-400">Carregando…</div>
    <div v-else class="max-w-md text-center text-sm text-on-surface-variant dark:text-slate-400">
      <p class="mb-4">Nenhum canal neste workspace.</p>
      <NuxtLink
        :to="`/workspaces/${workspaceId}/canais`"
        class="font-medium text-primary underline underline-offset-2 hover:text-primary/90"
      >
        Ir para Canais
      </NuxtLink>
    </div>
  </div>
</template>
