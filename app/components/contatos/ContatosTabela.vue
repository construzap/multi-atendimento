<script setup lang="ts">
import { computed } from 'vue'
import type { Contato } from '#shared/types/contato'
import BaseAvatar from '~/components/BaseAvatar.vue'

const props = withDefaults(
  defineProps<{
    items: Contato[]
    pending?: boolean
    error?: string | null
  }>(),
  {
    pending: false,
    error: null,
  },
)

function firstNonEmpty(...vals: Array<string | null | undefined>): string {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}

function formatIso(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(d)
}

const rows = computed(() => props.items ?? [])
</script>

<template>
  <div class="overflow-hidden rounded-2xl border border-outline/40 bg-surface-container-lowest shadow-sm dark:border-dark-outline/40 dark:bg-dark-surface-container-low">
    <div class="border-b border-outline/30 px-5 py-4 dark:border-dark-outline/30">
      <div class="flex items-center justify-between gap-4">
        <div>
          <h2 class="font-headline text-base font-bold text-on-surface dark:text-dark-on-surface">Contatos</h2>
          <p class="mt-0.5 text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
            {{ rows.length }} registro(s)
          </p>
        </div>
        <div v-if="pending" class="text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
          Carregando…
        </div>
      </div>
    </div>

    <div v-if="error" class="m-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-200">
      {{ error }}
    </div>

    <div v-else-if="!pending && rows.length === 0" class="m-5 rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
      Nenhum contato encontrado.
    </div>

    <div v-else class="w-full overflow-x-auto">
      <table class="w-full min-w-[56rem] border-separate border-spacing-0">
        <thead>
          <tr class="text-left text-xs font-semibold text-on-surface-variant dark:text-dark-on-surface-variant">
            <th class="sticky top-0 z-[1] bg-surface-container-lowest px-5 py-3 dark:bg-dark-surface-container-low">Contato</th>
            <th class="sticky top-0 z-[1] bg-surface-container-lowest px-5 py-3 dark:bg-dark-surface-container-low">Telefone</th>
            <th class="sticky top-0 z-[1] bg-surface-container-lowest px-5 py-3 dark:bg-dark-surface-container-low">LID</th>
            <th class="sticky top-0 z-[1] bg-surface-container-lowest px-5 py-3 dark:bg-dark-surface-container-low">Canal</th>
            <th class="sticky top-0 z-[1] bg-surface-container-lowest px-5 py-3 text-right dark:bg-dark-surface-container-low">Atualizado</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="c in rows"
            :key="c.key"
            class="border-t border-outline/20 text-sm text-on-surface hover:bg-surface-container-low dark:border-dark-outline/20 dark:text-dark-on-surface dark:hover:bg-dark-surface-container-high"
          >
            <td class="px-5 py-4">
              <div class="flex items-center gap-3">
                <BaseAvatar
                  :src="c.photo ?? null"
                  :alt="firstNonEmpty(c.name, c.phone, c.lid, 'Contato')"
                  :text="(firstNonEmpty(c.name, c.phone, c.lid, '?')[0] ?? '?').toUpperCase()"
                  :size="36"
                  variant="circle"
                />
                <div class="min-w-0">
                  <div class="truncate font-semibold">{{ firstNonEmpty(c.name, c.phone, c.lid, c.key) }}</div>
                  <div class="mt-0.5 truncate text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
                    key: {{ c.key }}
                  </div>
                </div>
              </div>
            </td>
            <td class="px-5 py-4 font-mono text-xs">{{ c.phone ?? '—' }}</td>
            <td class="px-5 py-4 font-mono text-xs">{{ c.lid ?? '—' }}</td>
            <td class="px-5 py-4 font-mono text-xs">#{{ c.id_canal ?? '—' }}</td>
            <td class="px-5 py-4 text-right text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
              {{ formatIso(c.updated_at ?? c.created_at) || '—' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

