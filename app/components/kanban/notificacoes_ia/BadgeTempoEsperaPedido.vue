<script setup lang="ts">
import { computed } from 'vue'
import {
  classesBordaTempoEspera,
  minutosDesdeCreatedAt,
  nivelTempoEspera,
} from './parseProdutosNotificacao'

const props = withDefaults(
  defineProps<{
    createdAt: string | null | undefined
    nowMs?: number
    /** `sm` = card kanban; `md` = item do modal */
    size?: 'sm' | 'md'
  }>(),
  {
    nowMs: undefined,
    size: 'sm',
  },
)

const minutos = computed(() =>
  minutosDesdeCreatedAt(props.createdAt, props.nowMs ?? Date.now()),
)

const nivel = computed(() => {
  const m = minutos.value
  if (m == null) return null
  return nivelTempoEspera(m)
})

/**
 * < 60 → minutos; ≥ 60 → horas; ≥ 24h → dias.
 * Cor continua pelo nível (60+ = crítico / vermelho).
 */
const exibicao = computed(() => {
  const m = minutos.value
  if (m == null) return null
  const mins = Math.max(1, m)
  if (mins < 60) return { valor: mins, unidade: 'min' as const }
  const horas = Math.floor(mins / 60)
  if (horas < 24) return { valor: horas, unidade: 'h' as const }
  return { valor: Math.floor(horas / 24), unidade: 'd' as const }
})

const borderClass = computed(() => {
  const n = nivel.value
  if (!n) return ''
  return classesBordaTempoEspera(n)
})

const sizeClass = computed(() =>
  props.size === 'md' ? 'h-12 w-12 border-[2.5px]' : 'h-10 w-10 border-2',
)

const valorClass = computed(() => {
  const digits = String(exibicao.value?.valor ?? '').length
  if (props.size === 'md') {
    return digits >= 3 ? 'text-xs' : 'text-sm'
  }
  return digits >= 3 ? 'text-[11px]' : 'text-[13px]'
})

const unidadeClass = computed(() =>
  props.size === 'md' ? 'text-[10px]' : 'text-[9px]',
)

const labelAria = computed(() => {
  const e = exibicao.value
  const n = nivel.value
  if (!e || !n) return ''
  const faixa =
    n === 'top' ? 'tempo top' : n === 'razoavel' ? 'tempo razoável' : 'tempo crítico'
  const unidadeLabel =
    e.unidade === 'min' ? 'minutos' : e.unidade === 'h' ? 'horas' : 'dias'
  return `${e.valor} ${unidadeLabel} — ${faixa}`
})
</script>

<template>
  <span
    v-if="exibicao && nivel"
    class="inline-flex shrink-0 flex-col items-center justify-center rounded-full bg-transparent leading-none"
    :class="[sizeClass, borderClass]"
    role="status"
    :aria-label="labelAria"
    :title="labelAria"
  >
    <span class="font-bold tabular-nums leading-none" :class="valorClass">
      {{ exibicao.valor }}
    </span>
    <span class="mt-0.5 font-medium leading-none opacity-80" :class="unidadeClass">
      {{ exibicao.unidade }}
    </span>
  </span>
</template>
