<script setup lang="ts">
import { computed } from 'vue'
import {
  parseCoordenadasValidas,
  urlGoogleMaps,
  urlWaze,
} from '#shared/utils/navegacaoMapas'

const props = withDefaults(
  defineProps<{
    latitude?: number | null
    longitude?: number | null
    /** Estilo visual do contexto (kanban vs página pública de entrega). */
    variant?: 'kanban' | 'entrega'
  }>(),
  { variant: 'kanban' },
)

const coordenadas = computed(() =>
  parseCoordenadasValidas(props.latitude, props.longitude),
)

const linkGoogleMaps = computed(() => {
  const c = coordenadas.value
  return c ? urlGoogleMaps(c) : null
})

const linkWaze = computed(() => {
  const c = coordenadas.value
  return c ? urlWaze(c) : null
})

const btnMapsClass =
  'inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold shadow-sm transition-colors min-[420px]:flex-none'

const btnMapsKanban =
  `${btnMapsClass} border-outline/40 bg-white text-on-surface hover:bg-surface-container-high dark:border-dark-outline/40 dark:bg-dark-surface-container-low dark:text-dark-on-surface dark:hover:bg-dark-surface-container-high`

const btnWazeKanban =
  `${btnMapsClass} border-[#33ccff]/50 bg-[#33ccff]/10 text-[#0078a8] hover:bg-[#33ccff]/20 dark:border-[#33ccff]/40 dark:bg-[#33ccff]/15 dark:text-[#7dd3fc] dark:hover:bg-[#33ccff]/25`

const btnMapsEntrega =
  `${btnMapsClass} border-slate-200 bg-white text-slate-800 hover:bg-slate-50`

const btnWazeEntrega =
  `${btnMapsClass} border-[#33ccff]/50 bg-[#33ccff]/10 text-[#0078a8] hover:bg-[#33ccff]/20`
</script>

<template>
  <div
    v-if="coordenadas && linkGoogleMaps && linkWaze"
    class="flex flex-wrap gap-2"
    :class="variant === 'kanban' ? '' : 'pt-1'"
  >
    <a
      :href="linkGoogleMaps"
      target="_blank"
      rel="noopener noreferrer"
      :class="variant === 'entrega' ? btnMapsEntrega : btnMapsKanban"
    >
      <span class="material-symbols-outlined text-[18px] leading-none" aria-hidden="true">
        map
      </span>
      Google Maps
    </a>
    <a
      :href="linkWaze"
      target="_blank"
      rel="noopener noreferrer"
      :class="variant === 'entrega' ? btnWazeEntrega : btnWazeKanban"
    >
      <span class="material-symbols-outlined text-[18px] leading-none" aria-hidden="true">
        navigation
      </span>
      Waze
    </a>
  </div>
</template>
