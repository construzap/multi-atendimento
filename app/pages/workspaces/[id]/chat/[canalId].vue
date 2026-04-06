<script setup lang="ts">
import AreaChat from '~/components/chat/area-chat.vue'
import AreaConversa from '~/components/chat/area-conversa.vue'
import AreaInfoConversa from '~/components/chat/area-info-conversa.vue'

definePageMeta({
  layout: 'workspace'
})

const route = useRoute()
const canaisStore = useCanaisStore()

function parsePositiveInt(raw: unknown): number | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  const n = Number.parseInt(s, 10)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return null
  // Garante que não veio algo como "2abc"
  if (String(n) !== s) return null
  return n
}

const canalId = computed(() => parsePositiveInt(route.params.canalId))
const workspaceId = computed(() => parsePositiveInt(route.params.id))

watch(
  canalId,
  (id) => {
    if (id == null) {
      throw createError({ statusCode: 404, statusMessage: 'Canal inválido.' })
    }
    // Essa linha é o gatilho que o plugin observa para refazer a busca.
    canaisStore.setCurrentCanalId(id)
  },
  { immediate: true }
)

onMounted(async () => {
  const wid = workspaceId.value
  if (wid != null) {
    await canaisStore.fetchCanais(wid).catch(() => {})
    // Depois do fetch, garante que o objeto completo seja preenchido (se existir na lista).
    if (canalId.value != null) canaisStore.setCurrentCanalId(canalId.value)
  }
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
