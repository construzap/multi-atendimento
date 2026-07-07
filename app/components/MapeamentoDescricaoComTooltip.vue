<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'

const props = defineProps<{
  descricao: string
  descricaoCompleta?: string
}>()

const mostrarTooltip = computed(() => {
  const full = props.descricaoCompleta?.trim()
  if (!full) return false
  return full !== props.descricao.trim()
})

const triggerRef = ref<HTMLElement | null>(null)
const tooltipVisivel = ref(false)
const tooltipStyle = ref<Record<string, string>>({})

function atualizarPosicaoTooltip() {
  const el = triggerRef.value
  if (!el) return

  const rect = el.getBoundingClientRect()
  const margin = 8
  const maxW = Math.min(320, window.innerWidth - margin * 2)
  let left = rect.right - maxW
  left = Math.max(margin, Math.min(left, window.innerWidth - maxW - margin))

  const espacoAcima = rect.top - margin * 2
  const espacoAbaixo = window.innerHeight - rect.bottom - margin * 2
  const abrirAcima = espacoAcima >= 48 || espacoAcima >= espacoAbaixo

  if (abrirAcima) {
    tooltipStyle.value = {
      position: 'fixed',
      left: `${left}px`,
      bottom: `${window.innerHeight - rect.top + margin}px`,
      width: `${maxW}px`,
      zIndex: '10000',
    }
  } else {
    tooltipStyle.value = {
      position: 'fixed',
      left: `${left}px`,
      top: `${rect.bottom + margin}px`,
      width: `${maxW}px`,
      zIndex: '10000',
    }
  }
}

function aoEntrar() {
  tooltipVisivel.value = true
  void nextTick(() => atualizarPosicaoTooltip())
}

function aoSair() {
  tooltipVisivel.value = false
}

function aoScrollOuResize() {
  if (tooltipVisivel.value) atualizarPosicaoTooltip()
}

onMounted(() => {
  window.addEventListener('scroll', aoScrollOuResize, true)
  window.addEventListener('resize', aoScrollOuResize)
})

onUnmounted(() => {
  window.removeEventListener('scroll', aoScrollOuResize, true)
  window.removeEventListener('resize', aoScrollOuResize)
})
</script>

<template>
  <span v-if="descricao" class="flex min-w-0 items-start gap-0.5 pl-4">
    <span
      class="min-w-0 flex-1 truncate text-[11px] leading-snug text-on-surface-variant dark:text-dark-on-surface-variant"
    >
      {{ descricao }}
    </span>
    <span
      v-if="mostrarTooltip"
      ref="triggerRef"
      class="shrink-0"
      @mouseenter="aoEntrar"
      @mouseleave="aoSair"
      @focusin="aoEntrar"
      @focusout="aoSair"
    >
      <span
        class="material-symbols-outlined cursor-help text-[14px] leading-none text-on-surface-variant/80 transition-colors hover:text-primary-600 focus:text-primary-600 dark:text-dark-on-surface-variant/80 dark:hover:text-primary-400 dark:focus:text-primary-400"
        tabindex="0"
        aria-label="Ver lista completa"
      >
        info
      </span>
    </span>

    <Teleport to="body">
      <span
        v-if="mostrarTooltip && tooltipVisivel"
        role="tooltip"
        :style="tooltipStyle"
        class="pointer-events-none whitespace-normal rounded-lg border border-outline/30 bg-white px-2.5 py-2 text-left text-[11px] font-normal leading-snug text-on-surface shadow-lg dark:border-dark-outline/40 dark:bg-dark-surface-container-high dark:text-dark-on-surface"
      >
        {{ descricaoCompleta }}
      </span>
    </Teleport>
  </span>
</template>
