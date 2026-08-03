<script setup lang="ts">
import type { CustoPorCanalRow } from '#shared/types/adminCustosIa'

defineProps<{
  item: CustoPorCanalRow
}>()

function formatBrl(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value)
}

function formatTokens(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value)
}

function formatData(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(d)
}
</script>

<template>
  <article
    class="w-full min-w-0 rounded-2xl border border-outline/40 bg-surface-container-lowest p-4 shadow-sm dark:border-dark-outline/40 dark:bg-dark-surface-container-low md:p-5"
  >
    <div class="flex min-w-0 flex-wrap items-start justify-between gap-3">
      <div class="min-w-0 flex-1">
        <h3 class="truncate font-headline text-base font-bold text-on-surface dark:text-dark-on-surface">
          {{ item.workspace_nome || `Workspace #${item.workspace_id}` }}
        </h3>
        <p class="mt-0.5 text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
          Workspace ID {{ item.workspace_id }}
          <template v-if="item.canal_id != null"> · Canal ID {{ item.canal_id }}</template>
        </p>
      </div>
      <p class="shrink-0 font-headline text-lg font-bold text-emerald-700 dark:text-emerald-400">
        {{ formatBrl(item.custo_total_brl) }}
      </p>
    </div>

    <div class="mt-4 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
      <div class="min-w-0">
        <p class="text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
          Canal
        </p>
        <p class="mt-1 break-words text-sm text-on-surface dark:text-dark-on-surface">
          {{ item.nome_canal || 'Custo Geral (Sem Canal)' }}
        </p>
      </div>
      <div class="min-w-0">
        <p class="text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
          Tokens
        </p>
        <p class="mt-1 text-sm text-on-surface dark:text-dark-on-surface">
          {{ formatTokens(item.total_tokens_usados) }}
        </p>
      </div>
    </div>

    <div class="mt-4 min-w-0">
      <p class="text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
        Modelos
      </p>
      <div class="mt-1.5 flex min-w-0 flex-wrap gap-1.5">
        <span
          v-for="modelo in item.modelos_usados"
          :key="modelo"
          class="inline-flex max-w-full truncate rounded-lg border border-outline/30 bg-surface-container-high px-2 py-0.5 text-xs font-medium text-on-surface-variant dark:border-dark-outline/30 dark:bg-dark-surface-container-high dark:text-dark-on-surface-variant"
        >
          {{ modelo }}
        </span>
        <span
          v-if="item.modelos_usados.length === 0"
          class="text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
        >
          —
        </span>
      </div>
    </div>

    <div
      class="mt-4 grid min-w-0 grid-cols-1 gap-4 border-t border-outline/20 pt-4 sm:grid-cols-2 dark:border-dark-outline/20"
    >
      <div class="min-w-0">
        <p class="text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
          Primeiro uso
        </p>
        <p class="mt-1 text-sm text-on-surface dark:text-dark-on-surface">
          {{ formatData(item.primeiro_uso_em) }}
        </p>
      </div>
      <div class="min-w-0">
        <p class="text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
          Último uso
        </p>
        <p class="mt-1 text-sm text-on-surface dark:text-dark-on-surface">
          {{ formatData(item.ultimo_uso_em) }}
        </p>
      </div>
    </div>
  </article>
</template>
