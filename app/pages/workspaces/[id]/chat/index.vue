<script setup lang="ts">
definePageMeta({
  layout: 'workspace'
})

const route = useRoute()
const workspaceId = computed(() => String(route.params.id ?? ''))

const canaisStore = useCanaisStore()
const pending = ref(true)

onMounted(async () => {
  pending.value = true
  try {
    const wid = Number.parseInt(workspaceId.value, 10)
    if (!Number.isFinite(wid)) return

    const list = await canaisStore.fetchCanais(wid).catch(() => [])
    if (list.length > 0) {
      // Define o canal atual ANTES do redirect, para disparar o watcher de conversas.
      canaisStore.setCurrentCanal(list[0]!)
      await navigateTo(`/workspaces/${workspaceId.value}/chat/${list[0]!.id}`, { replace: true })
    }
  } finally {
    pending.value = false
  }
})
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
