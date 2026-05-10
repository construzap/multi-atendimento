<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  canais: number | null
  canaisCriados: number
}>()

const limite = computed(() =>
  props.canais === null || props.canais === undefined ? null : props.canais
)

const usoPct = computed(() => {
  const max = limite.value
  if (max == null || max <= 0) return null
  return Math.min(100, Math.round((props.canaisCriados / max) * 100))
})

const textoUso = computed(() => {
  if (limite.value == null) {
    return `${props.canaisCriados} utilizados`
  }
  return `${props.canaisCriados} de ${limite.value} utilizados`
})

/** Aviso estilo print: próximo do limite. */
const mostrarAvisoLimite = computed(() => {
  const max = limite.value
  const pct = usoPct.value
  if (max == null || max <= 0 || pct === null) return false
  const restantes = max - props.canaisCriados
  return pct >= 70 || restantes <= 1
})
</script>

<template>
  <div class="border-t border-outline/30 px-5 pb-5 pt-5 dark:border-dark-outline/30">
    <div class="flex items-start gap-4 sm:items-center sm:gap-5">
      <div
        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-outline/40 bg-surface-container-high text-on-surface-variant dark:border-dark-outline/40 dark:bg-dark-surface-container-high dark:text-dark-on-surface-variant"
        aria-hidden="true"
      >
        <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 22v-5" />
          <path d="M9 8V2" />
          <path d="M15 8V2" />
          <path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z" />
        </svg>
      </div>

      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p class="font-label text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant dark:text-dark-on-surface-variant">
              Canais
            </p>
            <p class="mt-1 font-headline text-lg font-bold text-on-surface dark:text-dark-on-surface">
              {{ textoUso }}
            </p>
          </div>
          <p
            v-if="usoPct !== null"
            class="shrink-0 font-headline text-lg font-bold tabular-nums text-warning dark:text-dark-warning"
          >
            {{ usoPct }}%
          </p>
        </div>

        <div
          v-if="usoPct !== null"
          class="mt-4 h-2 overflow-hidden rounded-full bg-surface-container-high dark:bg-dark-surface-container-high"
          role="progressbar"
          :aria-valuenow="usoPct"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-label="Uso dos canais em relação ao limite"
        >
          <div
            class="h-full rounded-full bg-warning transition-[width] duration-300 dark:bg-dark-warning"
            :style="{ width: `${usoPct}%` }"
          />
        </div>

        <div
          v-if="mostrarAvisoLimite && usoPct !== null"
          class="mt-3 flex items-start gap-2 text-warning dark:text-dark-warning"
        >
          <svg class="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" stroke-linecap="round" />
          </svg>
          <p class="font-body text-xs leading-snug">
            Você está próximo do limite de canais.
          </p>
        </div>

        <p
          v-if="usoPct === null && limite === null"
          class="mt-2 font-body text-xs text-on-surface-variant dark:text-dark-on-surface-variant"
        >
          Limite de canais não definido no plano.
        </p>
      </div>
    </div>
  </div>
</template>
