<script setup lang="ts">
import { computed, ref, watch } from 'vue'

function initialsFromLabel(s: string): string {
  const parts = s
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length >= 2) {
    const a = parts[0]?.[0]
    const b = parts[parts.length - 1]?.[0]
    if (a && b) return (a + b).toUpperCase()
  }
  return s.trim().slice(0, 2).toUpperCase() || '?'
}

const props = withDefaults(
  defineProps<{
    /** URL da imagem a exibir (http/https ou path). */
    src?: string | null
    /** Alias de `src` — mesma URL de imagem. */
    imageUrl?: string | null
    /** Texto alternativo (opcional) */
    alt?: string
    /** Texto fallback (ex: iniciais) */
    text?: string
    /** Tamanho em px */
    size?: number
    /** Classe extra para o container */
    class?: string
    /** Estilo de fundo/gradiente quando não houver imagem */
    fallbackClass?: string
    /** Se true, usa formato quadrado arredondado (workspace). Se false, circular. */
    variant?: 'rounded' | 'circle'
  }>(),
  {
    src: null,
    imageUrl: null,
    alt: '',
    text: '',
    size: 56,
    class: '',
    fallbackClass: 'bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-sm',
    variant: 'rounded'
  }
)

const failed = ref(false)

/** URL efetiva: `imageUrl` ou `src` (string vazia conta como ausente). */
const effectiveSrc = computed(() => {
  const raw = props.imageUrl ?? props.src
  if (raw == null || typeof raw !== 'string') return ''
  const t = raw.trim()
  return t.length ? t : ''
})

watch(effectiveSrc, () => {
  failed.value = false
})

const hasImage = computed(() => Boolean(effectiveSrc.value) && !failed.value)

/** Sem URL: pode mostrar iniciais. Com URL inválida/quebrada: só ícone. */
const showInitials = computed(
  () => Boolean(props.text?.trim()) && !effectiveSrc.value && !failed.value
)

const shapeClass = computed(() => (props.variant === 'circle' ? 'rounded-full' : 'rounded-xl'))
</script>

<template>
  <div
    :class="[
      'relative inline-flex items-center justify-center overflow-hidden select-none',
      shapeClass,
      props.class,
    ]"
    :style="{ width: `${size}px`, height: `${size}px` }"
    aria-hidden="true"
  >
    <img
      v-if="hasImage"
      :src="effectiveSrc"
      :alt="alt"
      class="h-full w-full object-cover"
      @error="failed = true"
    />

    <div
      v-else
      class="flex h-full w-full items-center justify-center"
      :class="fallbackClass"
    >
      <slot name="fallback">
        <span v-if="showInitials" class="font-headline text-lg font-bold leading-none">
          {{ initialsFromLabel(props.text || '') }}
        </span>
        <!-- Ícone padrão: sem URL, sem texto, ou URL quebrada -->
        <svg
          v-else
          class="h-[55%] w-[55%] max-h-[2rem] max-w-[2rem] text-white/95"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
          />
        </svg>
      </slot>
    </div>
  </div>
</template>

