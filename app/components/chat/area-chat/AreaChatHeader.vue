<script setup lang="ts">
import BaseAvatar from '~/components/BaseAvatar.vue'
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import type { Conversa } from '#shared/types/conversa'

const conversasStore = useConversasStore()
const { conversaAtual, items } = storeToRefs(conversasStore)

function firstNonEmpty(...vals: Array<string | null | undefined>): string {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}

function sortIsoAsc(a: string | null, b: string | null): number {
  const da = a ? new Date(a).getTime() : 0
  const db = b ? new Date(b).getTime() : 0
  return da - db
}

const conversaSelecionada = computed<Conversa | null>(() => {
  const key = conversaAtual.value
  if (!key) return null
  const list = items.value
  if (!list?.length) return null

  const filtrada = list.filter((m) => firstNonEmpty(m.lid, m.phone, m.key) === key)
  if (!filtrada.length) return null

  // Pega o registro mais recente dessa conversa para extrair nome/foto/phone.
  const sorted = [...filtrada].sort((a, b) => {
    const ta = a.updated_at ?? a.created_at
    const tb = b.updated_at ?? b.created_at
    return sortIsoAsc(ta ?? null, tb ?? null)
  })
  return sorted[sorted.length - 1] ?? null
})

const avatarUrl = computed<string | undefined>(() => conversaSelecionada.value?.photo ?? undefined)
const nome = computed(() => firstNonEmpty(conversaSelecionada.value?.name, conversaSelecionada.value?.phone, conversaAtual.value))
const telefone = computed(() => firstNonEmpty(conversaSelecionada.value?.phone, conversaAtual.value))

const menuRoot = ref<HTMLElement | null>(null)
const menuOpen = ref(false)

function toggleMenu() {
  menuOpen.value = !menuOpen.value
}

function closeMenu() {
  menuOpen.value = false
}

function onDocPointerDown(ev: PointerEvent) {
  if (!menuOpen.value) return
  const root = menuRoot.value
  if (!root) return
  const target = ev.target
  if (target instanceof Node && root.contains(target)) return
  closeMenu()
}

function fecharConversa() {
  conversasStore.setConversaAtual(null)
  closeMenu()
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocPointerDown)
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocPointerDown)
})
</script>

<template>
  <header
    class="flex h-16 shrink-0 items-center justify-between border-b border-outline-variant/10 bg-white px-6 dark:bg-slate-950"
  >
    <div class="flex min-w-0 items-center gap-3">
      <BaseAvatar :image-url="avatarUrl" :alt="nome" :size="40" variant="circle" />
      <div class="min-w-0">
        <h2 class="truncate font-headline text-base font-semibold text-slate-900 dark:text-slate-100">
          {{ nome }}
        </h2>
        <p class="text-[10px] text-on-surface-variant dark:text-slate-400">
          {{ telefone }}
        </p>
      </div>
    </div>

    <div class="flex shrink-0 items-center gap-2 text-slate-500 dark:text-slate-400">
      <button type="button" class="rounded-full p-2 hover:bg-slate-50 dark:hover:bg-slate-900" aria-label="Vídeo">
        <span class="material-symbols-outlined" aria-hidden="true">videocam</span>
      </button>
      <button type="button" class="rounded-full p-2 hover:bg-slate-50 dark:hover:bg-slate-900" aria-label="Ligar">
        <span class="material-symbols-outlined" aria-hidden="true">call</span>
      </button>
      <button type="button" class="rounded-full p-2 hover:bg-slate-50 dark:hover:bg-slate-900" aria-label="Buscar">
        <span class="material-symbols-outlined" aria-hidden="true">search</span>
      </button>
      <div ref="menuRoot" class="relative">
        <button
          type="button"
          class="rounded-full p-2 hover:bg-slate-50 dark:hover:bg-slate-900"
          aria-label="Mais opções"
          aria-haspopup="menu"
          :aria-expanded="menuOpen ? 'true' : 'false'"
          aria-controls="menu-opcoes-conversa"
          @click="toggleMenu"
        >
          <span class="material-symbols-outlined" aria-hidden="true">more_vert</span>
        </button>

        <div
          v-if="menuOpen"
          id="menu-opcoes-conversa"
          class="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-950"
          role="menu"
        >
          <button
            type="button"
            class="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-900"
            role="menuitem"
            @click="fecharConversa"
          >
            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">close</span>
            Fechar conversa
          </button>
        </div>
      </div>
    </div>
  </header>
</template>
