<script setup lang="ts">
import type { CustoTokenIaErroRow } from '#shared/types/adminCustosIa'

defineProps<{
  item: CustoTokenIaErroRow
}>()
</script>

<template>
  <article
    class="rounded-2xl border border-danger/25 bg-surface-container-lowest p-4 shadow-sm dark:border-danger/30 dark:bg-dark-surface-container-low md:p-5"
  >
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <h3 class="font-headline text-base font-bold text-on-surface dark:text-dark-on-surface">
          Workspace {{ item.workspace_id }}
        </h3>
        <p class="mt-0.5 text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
          Canal {{ item.canal_id || '—' }}
        </p>
      </div>
      <span
        class="shrink-0 rounded-lg bg-danger/10 px-2.5 py-1 text-xs font-semibold text-danger dark:text-dark-danger"
      >
        Erro
      </span>
    </div>

    <dl class="mt-4 space-y-3">
      <div>
        <dt class="text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-dark-on-surface-variant">
          URL do erro
        </dt>
        <dd class="mt-1 break-all text-sm text-on-surface dark:text-dark-on-surface">
          <a
            v-if="item.url_erro"
            :href="item.url_erro"
            target="_blank"
            rel="noopener noreferrer"
            class="text-primary-600 underline-offset-2 hover:underline dark:text-dark-primary"
          >
            {{ item.url_erro }}
          </a>
          <span v-else class="text-on-surface-variant dark:text-dark-on-surface-variant">—</span>
        </dd>
      </div>
    </dl>
  </article>
</template>
