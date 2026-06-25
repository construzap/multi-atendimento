<script setup lang="ts">
definePageMeta({
  layout: 'workspace'
})

const route = useRoute()
const workspaceId = computed(() => String(route.params.id ?? ''))

const canaisStore = useCanaisStore()
const pending = ref(true)

const cookieName = computed(() => `last_chat_canal_ws_${workspaceId.value || '0'}`)
const lastCanalCookie = useCookie<string | null>(cookieName.value)

onMounted(async () => {
  pending.value = true
  try {
    const wid = Number.parseInt(workspaceId.value, 10)
    if (!Number.isFinite(wid)) return

    await canaisStore.ensureCanaisLoaded(wid).catch(() => {})
    const list = canaisStore.items
    if (list.length > 0) {
      const preferredRaw = String(lastCanalCookie.value ?? '').trim()
      const preferredId = preferredRaw ? Number.parseInt(preferredRaw, 10) : NaN
      const target = Number.isFinite(preferredId) ? list.find((c) => c.id === preferredId) : null
      const next = target ?? list[0]!

      // Define o canal atual ANTES do redirect, para disparar o watcher de conversas.
      canaisStore.setCurrentCanal(next)
      lastCanalCookie.value = String(next.id)
      await navigateTo(`/workspaces/${workspaceId.value}/chat/${next.id}`, { replace: true })
    }
  } finally {
    pending.value = false
  }
})
</script>

<template>
  <div class="flex h-[100dvh] min-h-0 items-center justify-center p-6">
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
