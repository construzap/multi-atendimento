<script setup lang="ts">
import { computed, ref } from 'vue'
import type { AdminEmpresaRow } from '#shared/types/admin'

const props = withDefaults(
  defineProps<{
    companies?: AdminEmpresaRow[]
    selectedCompanyId?: string | null
    showWhatsAppBadge?: boolean
    loading?: boolean
  }>(),
  {
    companies: () => [],
    selectedCompanyId: null,
    showWhatsAppBadge: false,
    loading: false,
  },
)

const emit = defineEmits<{
  select: [company: AdminEmpresaRow]
}>()

const search = ref('')

const filtered = computed(() => {
  const s = search.value.trim().toLowerCase()
  const items = props.companies
  if (!s) return items
  return items.filter(
    (c) =>
      (c.name ?? '').toLowerCase().includes(s) ||
      c.id.toLowerCase().includes(s),
  )
})

function displayName(company: AdminEmpresaRow) {
  const n = company.name?.trim()
  return n ? n : '(sem nome)'
}

function shortId(id: string) {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div class="shrink-0 border-b border-outline/40 p-3 dark:border-dark-outline/40">
      <div class="relative">
        <svg
          class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant dark:text-dark-on-surface-variant"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" stroke-linecap="round" />
        </svg>
        <input
          v-model="search"
          type="text"
          placeholder="Buscar workspace..."
          class="h-8 w-full rounded-lg border border-outline/40 bg-surface-container-high py-0 pl-9 pr-3 text-sm text-on-surface placeholder:text-on-surface-variant/70 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 dark:border-dark-outline/40 dark:bg-dark-surface-container-high dark:text-dark-on-surface dark:placeholder:text-dark-on-surface-variant/60"
        />
      </div>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto">
      <div
        v-if="loading"
        class="flex items-center justify-center gap-2 py-10 text-on-surface-variant dark:text-dark-on-surface-variant"
      >
        <svg
          class="h-5 w-5 animate-spin"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <span class="text-sm">Carregando...</span>
      </div>

      <p
        v-else-if="!filtered.length"
        class="py-10 text-center text-sm text-on-surface-variant dark:text-dark-on-surface-variant"
      >
        Nenhum workspace encontrado.
      </p>

      <ul v-else class="divide-y divide-outline/30 dark:divide-dark-outline/30">
        <li v-for="c in filtered" :key="c.id">
          <button
            type="button"
            class="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-surface-container-high/80 dark:hover:bg-dark-surface-container-high/60"
            :class="
              c.id === selectedCompanyId
                ? 'border-r-2 border-primary-500 bg-primary-50/60 dark:bg-primary-950/25'
                : ''
            "
            @click="emit('select', c)"
          >
            <div
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
              :class="
                c.id === selectedCompanyId
                  ? 'bg-primary-500 text-white'
                  : 'bg-surface-container-high text-on-surface-variant dark:bg-dark-surface-container-high dark:text-dark-on-surface-variant'
              "
              aria-hidden="true"
            >
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 21h18M5 21V7l7-4 7 4v14" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M9 10h1M14 10h1M9 14h1M14 14h1" stroke-linecap="round" />
              </svg>
            </div>

            <div class="min-w-0 flex-1">
              <p
                class="truncate text-sm font-medium"
                :class="
                  c.id === selectedCompanyId
                    ? 'text-primary-700 dark:text-primary-300'
                    : 'text-on-surface dark:text-dark-on-surface'
                "
              >
                {{ displayName(c) }}
              </p>
              <p class="truncate font-mono text-[10px] text-on-surface-variant/70 dark:text-dark-on-surface-variant/70">
                ID: {{ shortId(c.id) }}
              </p>
            </div>

            <div
              v-if="showWhatsAppBadge"
              class="flex shrink-0 flex-col items-end gap-1"
            >
              <span
                class="rounded-md border px-1.5 py-0 text-[10px] font-medium"
                :class="
                  c.instance_count > 0
                    ? 'border-success/50 text-success dark:text-success'
                    : 'border-outline/40 bg-surface-container-high text-on-surface-variant dark:border-dark-outline/40 dark:bg-dark-surface-container-high dark:text-dark-on-surface-variant'
                "
              >
                {{ c.instance_count > 0 ? `${c.instance_count} inst.` : 'Desconectado' }}
              </span>
            </div>
          </button>
        </li>
      </ul>
    </div>

    <div class="shrink-0 border-t border-outline/40 bg-surface-container-high/40 px-3 py-2 dark:border-dark-outline/40 dark:bg-dark-surface-container-high/30">
      <p class="text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
        {{ filtered.length }} workspace(s)
      </p>
    </div>
  </div>
</template>
