<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'

withDefaults(
  defineProps<{
    title: string
    align?: 'left' | 'right'
    /** Lado em que o painel abre (ex.: no rodapé, use `top`). */
    side?: 'top' | 'bottom'
    /** Largura mínima do painel (Tailwind: ex. w-64) */
    panelClass?: string
  }>(),
  {
    align: 'right',
    side: 'bottom',
    panelClass: 'w-64 min-w-[14rem]'
  }
)

const open = ref(false)
const root = ref<HTMLElement | null>(null)

function close() {
  open.value = false
}

function toggle() {
  open.value = !open.value
}

let removeDocListener: (() => void) | null = null
let attachTimeout: ReturnType<typeof setTimeout> | null = null

function onDocumentPointerDown(e: PointerEvent) {
  const el = root.value
  if (!el || el.contains(e.target as Node)) return
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

  if (!isOpen) return

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

onUnmounted(() => {
  if (attachTimeout) clearTimeout(attachTimeout)
  removeDocListener?.()
})
</script>

<template>
  <div ref="root" class="relative inline-flex">
    <button
      type="button"
      class="inline-flex items-center rounded-full ring-2 ring-transparent outline-none transition-all hover:ring-primary-200 focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:ring-primary-900/40"
      :aria-expanded="open"
      aria-haspopup="true"
      @click.stop="toggle"
    >
      <slot name="trigger" />
    </button>

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
        class="absolute z-50 rounded-2xl border border-outline/40 bg-surface-container-lowest py-2 shadow-lg ring-1 ring-black/5 dark:border-dark-outline/40 dark:bg-dark-surface-container-low dark:ring-white/10"
        :class="[
          panelClass,
          align === 'right' ? 'right-0' : 'left-0',
          side === 'top'
            ? 'bottom-full mb-2 origin-bottom'
            : 'top-full mt-2 origin-top',
        ]"
        role="menu"
        :aria-label="title"
      >
        <p
          class="px-4 pb-2 pt-1 font-label text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant"
        >
          {{ title }}
        </p>
        <div class="mx-2 border-t border-outline/30 dark:border-dark-outline/30" />
        <div class="px-1.5 py-1.5">
          <slot :close="close" />
        </div>
      </div>
    </Transition>
  </div>
</template>
