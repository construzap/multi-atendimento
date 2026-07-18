<script setup lang="ts">
import { onUnmounted, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    /** permite ocultar o botão X */
    showClose?: boolean
    /** largura do painel (Tailwind) */
    panelClass?: string
    /** classes extras na área de conteúdo (slot default) */
    bodyClass?: string
    /** fechar ao clicar fora do painel */
    closeOnBackdrop?: boolean
    /** fechar com Escape */
    closeOnEscape?: boolean
  }>(),
  {
    showClose: true,
    panelClass: 'w-full max-w-lg',
    bodyClass: '',
    closeOnBackdrop: true,
    closeOnEscape: true,
  },
)

const emit = defineEmits<{
  'update:open': [value: boolean]
  close: []
}>()

function close() {
  emit('update:open', false)
  emit('close')
}

function onBackdropClick() {
  if (props.closeOnBackdrop) close()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.closeOnEscape) close()
}

watch(
  () => props.open,
  (isOpen) => {
    if (!process.client) return
    if (isOpen) document.addEventListener('keydown', onKeydown)
    else document.removeEventListener('keydown', onKeydown)
  },
  { immediate: true }
)

onUnmounted(() => {
  if (!process.client) return
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
        @click.self="onBackdropClick"
      >
        <Transition
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="opacity-0 translate-y-2 scale-95"
          enter-to-class="opacity-100 translate-y-0 scale-100"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="opacity-100 translate-y-0 scale-100"
          leave-to-class="opacity-0 translate-y-2 scale-95"
        >
          <div
            class="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-outline/40 bg-surface-container-lowest shadow-xl dark:border-dark-outline/40 dark:bg-dark-surface-container-low"
            :class="panelClass"
          >
            <header class="flex shrink-0 items-start justify-between gap-4 border-b border-outline/30 p-5 dark:border-dark-outline/30">
              <div class="flex items-start gap-3">
                <div
                  v-if="$slots.icon"
                  class="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-container-high text-primary-600 dark:bg-dark-surface-container-high dark:text-dark-primary"
                  aria-hidden="true"
                >
                  <slot name="icon" />
                </div>
                <div>
                  <h2 class="font-headline text-lg font-bold text-on-surface dark:text-dark-on-surface">
                    {{ title }}
                  </h2>
                  <p v-if="$slots.subtitle" class="mt-0.5 text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
                    <slot name="subtitle" />
                  </p>
                </div>
              </div>

              <button
                v-if="showClose"
                type="button"
                class="rounded-xl p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface dark:text-dark-on-surface-variant dark:hover:bg-dark-surface-container-high dark:hover:text-dark-on-surface"
                aria-label="Fechar"
                @click="close"
              >
                <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" />
                </svg>
              </button>
            </header>

            <div
              class="min-h-0 flex-1 overflow-y-auto p-5"
              :class="bodyClass"
            >
              <slot />
            </div>

            <footer
              v-if="$slots.footer"
              class="shrink-0 border-t border-outline/30 p-5 dark:border-dark-outline/30"
            >
              <div class="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <slot name="footer" />
              </div>
            </footer>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

