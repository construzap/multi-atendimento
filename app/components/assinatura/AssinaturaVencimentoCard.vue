<script setup lang="ts">
import { computed } from 'vue'
import type { StatusAssinatura } from '#shared/types/profile'

const props = defineProps<{
  dataExpiracao: string | null
  status: StatusAssinatura | null
}>()

const rotuloVencimento = computed(() => {
  const s = props.status
  if (s === 'pendente' || s === 'cancelado' || s === 'vencida') return 'Venceu em'
  return 'Próximo vencimento'
})

function parseExpiracao(raw: string): Date | null {
  const s = raw.trim()
  let iso = s.includes('T') ? s : s.replace(' ', 'T')
  if (/\+\d{2}$/.test(iso)) iso = iso.replace(/\+(\d{2})$/, '+$1:00')
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Ex.: “03 de maio de 2026” (como no print). */
const dataLegivel = computed(() => {
  if (!props.dataExpiracao) return null
  const d = parseExpiracao(props.dataExpiracao)
  if (!d) return null
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  })
})
</script>

<template>
  <div class="flex items-start gap-4 border-t border-outline/30 px-5 py-5 dark:border-dark-outline/30 sm:items-center sm:gap-5">
    <div
      class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-outline/40 bg-surface-container-high text-on-surface-variant dark:border-dark-outline/40 dark:bg-dark-surface-container-high dark:text-dark-on-surface-variant"
      aria-hidden="true"
    >
      <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M16 2v4M8 2v4M3 10h18" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </div>

    <div class="min-w-0 flex-1">
      <p class="font-label text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant dark:text-dark-on-surface-variant">
        {{ rotuloVencimento }}
      </p>
      <p class="mt-1 font-headline text-lg font-bold leading-snug text-on-surface dark:text-dark-on-surface">
        <template v-if="dataLegivel">{{ dataLegivel }}</template>
        <template v-else>—</template>
      </p>
    </div>
  </div>
</template>
