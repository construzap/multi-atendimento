<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'

const props = withDefaults(
  defineProps<{
    /** URL da imagem (opcional) */
    src?: string | null
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
    alt: '',
    text: '',
    size: 56,
    class: '',
    fallbackClass: 'bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-sm',
    variant: 'rounded'
  }
)

const failed = ref(false)

watchEffect(() => {
  // Se o src mudar, reseta erro de carregamento
  failed.value = false
})

const hasImage = computed(() => Boolean(props.src) && !failed.value)

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
      :src="src || undefined"
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
        <span v-if="text" class="font-headline text-lg font-bold leading-none">
          {{ text }}
        </span>
        <svg
          v-else
          class="h-7 w-7"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          aria-hidden="true"
        >
          <rect x="3" y="3.5" width="18" height="17" rx="2.5" />
          <path
            d="M7 16.5V14.7c0-1 1-1.9 2.1-2.2 1.9-.6 3.9-.6 5.8 0 1.1.3 2.1 1.2 2.1 2.2v1.8"
            stroke-linecap="round"
          />
          <circle cx="12" cy="9.5" r="2.3" />
        </svg>
      </slot>
    </div>
  </div>
</template>

