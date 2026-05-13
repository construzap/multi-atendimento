<script setup lang="ts">
import { nextTick, onUnmounted, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    title: string
    align?: 'left' | 'right'
    /** Lado em que o painel abre (ex.: no rodapé, use `top`). */
    side?: 'bottom' | 'top'
    /** Largura mínima do painel (Tailwind: ex. w-64) */
    panelClass?: string
    /**
     * Quando `true`, o painel é renderizado em `body` com posição fixa e
     * reposiciona em scroll/redimensionamento — evita corte por `overflow` de antepassados (ex.: modais com scroll).
     */
    teleport?: boolean
  }>(),
  {
    align: 'right',
    side: 'bottom',
    panelClass: 'w-64 min-w-[14rem]',
    teleport: false,
  },
)

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLButtonElement | null>(null)
const panelRefTeleport = ref<HTMLElement | null>(null)

/** Estilos inline do painel em modo `teleport` (posição fixa na viewport). */
const panelFixedStyle = ref<Record<string, string>>({})

function close() {
  open.value = false
}

function toggle() {
  open.value = !open.value
}

function updateTeleportPanelPosition() {
  if (!props.teleport || !open.value) return
  const btn = triggerRef.value
  if (!btn) return

  const rect = btn.getBoundingClientRect()
  const margin = 8
  const minW = 288
  const panelW = Math.max(rect.width, minW)
  let left = props.align === 'right' ? rect.right - panelW : rect.left
  left = Math.max(margin, Math.min(left, window.innerWidth - panelW - margin))

  const spaceBelow = window.innerHeight - rect.bottom - margin * 2
  const spaceAbove = rect.top - margin * 2
  const desiredMax = Math.min(400, Math.floor(window.innerHeight * 0.7))

  const openUp =
    props.side === 'bottom' && spaceBelow < 140 && spaceAbove > spaceBelow && spaceAbove > 80

  if (props.side === 'top' || openUp) {
    const maxH = Math.min(desiredMax, Math.max(120, spaceAbove))
    panelFixedStyle.value = {
      position: 'fixed',
      left: `${left}px`,
      width: `${panelW}px`,
      bottom: `${window.innerHeight - rect.top + margin}px`,
      maxHeight: `${maxH}px`,
      zIndex: '100',
      display: 'flex',
      flexDirection: 'column',
    }
  } else {
    const maxH = Math.min(desiredMax, Math.max(120, spaceBelow))
    panelFixedStyle.value = {
      position: 'fixed',
      left: `${left}px`,
      top: `${rect.bottom + margin}px`,
      width: `${panelW}px`,
      maxHeight: `${maxH}px`,
      zIndex: '100',
      display: 'flex',
      flexDirection: 'column',
    }
  }
}

let removeDocListener: (() => void) | null = null
let removeRepositionListeners: (() => void) | null = null
let attachTimeout: ReturnType<typeof setTimeout> | null = null

function clearRepositionListeners() {
  removeRepositionListeners?.()
  removeRepositionListeners = null
}

function attachRepositionListeners() {
  clearRepositionListeners()
  const onScrollOrResize = () => {
    updateTeleportPanelPosition()
  }
  window.addEventListener('scroll', onScrollOrResize, true)
  window.addEventListener('resize', onScrollOrResize)
  removeRepositionListeners = () => {
    window.removeEventListener('scroll', onScrollOrResize, true)
    window.removeEventListener('resize', onScrollOrResize)
  }
}

function onDocumentPointerDown(e: PointerEvent) {
  const t = e.target as Node
  if (root.value?.contains(t)) return
  if (props.teleport && panelRefTeleport.value?.contains(t)) return
  close()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}

watch(open, (isOpen) => {
  if (attachTimeout) {
    clearTimeout(attachTimeout)
    attachTimeout = null
  }
  removeDocListener?.()
  removeDocListener = null
  clearRepositionListeners()

  if (!isOpen) {
    panelFixedStyle.value = {}
    return
  }

  if (props.teleport) {
    void nextTick(() => {
      updateTeleportPanelPosition()
      attachRepositionListeners()
    })
  }

  attachTimeout = setTimeout(() => {
    attachTimeout = null
    document.addEventListener('pointerdown', onDocumentPointerDown, true)
    document.addEventListener('keydown', onKeydown)
    removeDocListener = () => {
      document.removeEventListener('pointerdown', onDocumentPointerDown, true)
      document.removeEventListener('keydown', onKeydown)
    }
  }, 0)
})

watch(
  () => [props.teleport, props.side, props.align, props.panelClass] as const,
  () => {
    if (open.value && props.teleport) void nextTick(() => updateTeleportPanelPosition())
  },
)

onUnmounted(() => {
  if (attachTimeout) clearTimeout(attachTimeout)
  removeDocListener?.()
  clearRepositionListeners()
})

const panelBodyClass =
  'rounded-2xl border border-outline/40 bg-surface-container-lowest py-2 shadow-lg ring-1 ring-black/5 dark:border-dark-outline/40 dark:bg-dark-surface-container-low dark:ring-white/10'
</script>

<template>
  <div ref="root" class="relative inline-flex min-w-0" :class="{ 'w-full': teleport }">
    <button
      ref="triggerRef"
      type="button"
      class="inline-flex w-full min-w-0 items-center rounded-full ring-2 ring-transparent outline-none transition-all hover:ring-primary-200 focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:ring-primary-900/40"
      :aria-expanded="open"
      aria-haspopup="true"
      @click.stop="toggle"
    >
      <slot name="trigger" />
    </button>

    <Transition
      v-if="!teleport"
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-show="open"
        class="absolute z-50 overflow-hidden"
        :class="[
          panelBodyClass,
          panelClass,
          align === 'right' ? 'right-0' : 'left-0',
          side === 'top' ? 'bottom-full mb-2 origin-bottom' : 'top-full mt-2 origin-top',
        ]"
        role="menu"
        :aria-label="title"
      >
        <p
          class="shrink-0 px-4 pb-2 pt-1 font-label text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant"
        >
          {{ title }}
        </p>
        <div class="mx-2 shrink-0 border-t border-outline/30 dark:border-dark-outline/30" />
        <div class="max-h-[min(70vh,22rem)] min-h-0 flex-1 overflow-y-auto overscroll-contain px-1.5 py-1.5">
          <slot :close="close" />
        </div>
      </div>
    </Transition>
  </div>

  <Teleport v-if="teleport" to="body">
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-show="open"
        ref="panelRefTeleport"
        class="overflow-hidden"
        :class="[panelBodyClass, panelClass]"
        :style="panelFixedStyle"
        role="menu"
        :aria-label="title"
      >
        <p
          class="shrink-0 px-4 pb-2 pt-1 font-label text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant"
        >
          {{ title }}
        </p>
        <div class="mx-2 shrink-0 border-t border-outline/30 dark:border-dark-outline/30" />
        <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1.5 py-1.5">
          <slot :close="close" />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
