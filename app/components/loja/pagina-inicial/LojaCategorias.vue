<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { LojaTermoPublico } from '#shared/types/loja'

const MOVE_PX = 10

const props = defineProps<{
  categorias: LojaTermoPublico[]
  modeloAtivo: number | null
}>()

const emit = defineEmits<{
  'update:modeloAtivo': [id: number]
  selecionar: [id: number]
  proximodoFim: []
}>()

const navRef = ref<HTMLElement | null>(null)
const chipRefs = ref<Record<string, HTMLButtonElement | null>>({})
const arrastandoMouse = ref(false)

let pointerId: number | null = null
let startX = 0
let startScroll = 0
let moveu = false

function setChipRef(id: number, el: unknown) {
  chipRefs.value[String(id)] = (el as HTMLButtonElement | null) ?? null
}

function irParaAncora(id: number) {
  emit('update:modeloAtivo', id)
  emit('selecionar', id)
}

function centralizarChip(id: number) {
  const nav = navRef.value
  const btn = chipRefs.value[String(id)]
  if (!nav || !btn) return

  const navRect = nav.getBoundingClientRect()
  const btnRect = btn.getBoundingClientRect()
  const delta = btnRect.left + btnRect.width / 2 - (navRect.left + navRect.width / 2)
  const max = Math.max(0, nav.scrollWidth - nav.clientWidth)
  const left = Math.min(max, Math.max(0, nav.scrollLeft + delta))
  nav.scrollTo({ left, behavior: 'smooth' })
}

function onClick(id: number) {
  const nav = navRef.value
  if (!nav) return
  if (moveu || Math.abs(nav.scrollLeft - startScroll) > MOVE_PX) return
  irParaAncora(id)
}

function onPointerDown(event: PointerEvent) {
  const nav = navRef.value
  if (!nav) return

  startX = event.clientX
  startScroll = nav.scrollLeft
  moveu = false
  pointerId = event.pointerId
  arrastandoMouse.value = false
}

function onPointerMove(event: PointerEvent) {
  const nav = navRef.value
  if (!nav || event.pointerId !== pointerId) return

  const delta = event.clientX - startX
  if (Math.abs(delta) <= MOVE_PX) return

  moveu = true

  if (event.pointerType !== 'mouse') return

  if (!arrastandoMouse.value) {
    arrastandoMouse.value = true
    nav.setPointerCapture(event.pointerId)
  }
  nav.scrollLeft = startScroll - delta
}

function onPointerUp(event: PointerEvent) {
  if (event.pointerId !== pointerId) return

  const nav = navRef.value
  if (nav?.hasPointerCapture(event.pointerId)) {
    nav.releasePointerCapture(event.pointerId)
  }
  arrastandoMouse.value = false
  pointerId = null
}

function onNavScroll() {
  const nav = navRef.value
  if (!nav) return
  const restante = nav.scrollWidth - nav.scrollLeft - nav.clientWidth
  if (restante <= 96) emit('proximodoFim')
}

watch(
  () => props.modeloAtivo,
  async (id) => {
    if (id == null) return
    await nextTick()
    centralizarChip(id)
  },
)

watch(
  () => props.categorias.map((c) => c.id).join(','),
  async () => {
    await nextTick()
    const list = props.categorias
    if (list.length < 3) return
    const alvo = list[list.length - 3]
    if (!alvo) return
    const btn = chipRefs.value[String(alvo.id)]
    const nav = navRef.value
    if (!btn || !nav) return
    const visible =
      btn.offsetLeft + btn.offsetWidth <= nav.scrollLeft + nav.clientWidth + 24
    if (visible) emit('proximodoFim')
  },
)

onBeforeUnmount(() => {
  arrastandoMouse.value = false
  pointerId = null
})
</script>

<template>
  <nav
    ref="navRef"
    class="loja-cats flex gap-1 overflow-x-auto overscroll-x-contain border-b border-outline/30 px-4 dark:border-dark-outline/30"
    :class="arrastandoMouse ? 'cursor-grabbing select-none' : 'cursor-grab'"
    aria-label="Categorias"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @scroll.passive="onNavScroll"
  >
    <button
      v-for="cat in categorias"
      :key="cat.id"
      type="button"
      :ref="(el) => setChipRef(cat.id, el)"
      class="shrink-0 touch-manipulation whitespace-nowrap border-b-2 px-3 py-3 text-sm transition-colors"
      :class="
        modeloAtivo === cat.id
          ? 'border-on-surface font-bold text-on-surface dark:border-dark-on-surface dark:text-dark-on-surface'
          : 'border-transparent font-medium text-on-surface-variant hover:text-on-surface dark:text-dark-on-surface-variant dark:hover:text-dark-on-surface'
      "
      @click="onClick(cat.id)"
    >
      {{ cat.nome }}
    </button>
  </nav>
</template>

<style scoped>
.loja-cats {
  -webkit-overflow-scrolling: touch;
  touch-action: pan-x;
  scrollbar-width: none;
  -ms-overflow-style: none;
  scroll-padding-inline: 1rem;
}
.loja-cats::-webkit-scrollbar {
  display: none;
}
</style>
