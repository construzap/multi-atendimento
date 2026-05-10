<script setup lang="ts">
import { computed } from 'vue'
import type { StatusAssinatura } from '#shared/types/profile'

const props = defineProps<{
  status: StatusAssinatura | null
}>()

/** Exibe o valor recebido da API em maiúsculas (ex.: ativo → ATIVO, cancelado → CANCELADO). */
const badgeTexto = computed(() => (props.status ? props.status.toUpperCase() : '—'))

const badgeWrapClass = computed(() => {
  switch (props.status) {
    case 'ativo':
      return 'border-success text-success dark:border-dark-success dark:text-dark-success'
    case 'trial':
      return 'border-info text-info dark:border-dark-info dark:text-dark-info'
    case 'vencida':
      return 'border-warning text-warning dark:border-dark-warning dark:text-dark-warning'
    case 'pendente':
      return 'border-outline/60 text-on-surface-variant dark:border-dark-outline/60 dark:text-dark-on-surface-variant'
    case 'cancelado':
      return 'border-danger text-danger dark:border-dark-danger dark:text-dark-danger'
    default:
      return 'border-outline/60 text-on-surface-variant dark:border-dark-outline/60 dark:text-dark-on-surface-variant'
  }
})

const dotClass = computed(() => {
  switch (props.status) {
    case 'ativo':
      return 'bg-success dark:bg-dark-success'
    case 'trial':
      return 'bg-info dark:bg-dark-info'
    case 'vencida':
      return 'bg-warning dark:bg-dark-warning'
    case 'pendente':
      return 'bg-on-surface-variant/50 dark:bg-dark-on-surface-variant/50'
    case 'cancelado':
      return 'bg-danger dark:bg-dark-danger'
    default:
      return 'bg-on-surface-variant/50 dark:bg-dark-on-surface-variant/50'
  }
})

const iconWrapClass = computed(() => {
  switch (props.status) {
    case 'ativo':
      return 'border-success/30 bg-success-container/50 text-success-on-container dark:border-dark-success/30 dark:bg-dark-success-container/40 dark:text-dark-on-success-container'
    case 'trial':
      return 'border-info/30 bg-info-container/60 text-info-on-container dark:border-dark-info/30 dark:bg-dark-info-container/40 dark:text-dark-on-info-container'
    default:
      return 'border-outline/40 bg-surface-container-high text-on-surface-variant dark:border-dark-outline/40 dark:bg-dark-surface-container-high dark:text-dark-on-surface-variant'
  }
})

</script>

<template>
  <div class="flex items-start gap-4 px-5 py-5 sm:items-center sm:gap-5">
    <div
      class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border"
      :class="iconWrapClass"
      aria-hidden="true"
    >
      <svg class="h-5 w-5 text-current" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </div>

    <div class="min-w-0 flex-1">
      <p class="font-headline text-base font-bold leading-tight text-on-surface dark:text-dark-on-surface">
        Plano atual
      </p>
      <p class="mt-0.5 font-body text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
        Detalhes da sua assinatura
      </p>
    </div>

    <div
      class="flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 font-label text-xs font-semibold"
      :class="badgeWrapClass"
    >
      <span class="h-2 w-2 shrink-0 rounded-full" :class="dotClass" aria-hidden="true" />
      {{ badgeTexto }}
    </div>
  </div>
</template>
