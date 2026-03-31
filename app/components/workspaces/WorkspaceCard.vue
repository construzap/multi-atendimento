<script setup lang="ts">
import { computed } from 'vue'
import BaseAvatar from '~/components/BaseAvatar.vue'

type WorkspaceStatus = 'ativo' | 'pausado' | 'arquivado'

const props = defineProps<{
  id: string
  name: string
  description: string
  createdAt: string
  avatarText: string
  avatarGradientClass: string
  avatarSrc?: string | null
  status: WorkspaceStatus
}>()

const emit = defineEmits<{
  select: [workspaceId: string]
}>()

const statusStyles: Record<WorkspaceStatus, { label: string; cls: string }> = {
  ativo: {
    label: 'Ativo',
    cls: 'bg-success-container text-success-on-container'
  },
  pausado: {
    label: 'Pausado',
    cls: 'bg-warning-container text-warning-on-container'
  },
  arquivado: {
    label: 'Arquivado',
    cls: 'bg-surface-container-high text-on-surface-variant dark:bg-dark-surface-container-high dark:text-dark-on-surface-variant'
  }
}

function formatCreatedAtPtBr(input: string) {
  // Aceita:
  // - ISO/timestamp (ex: 2026-03-31T10:00:00Z)
  // - abreviações do mock (ex: 2m, 5h, 2d, 1w)
  // - texto pronto (ex: "Hoje") -> retornamos o texto como fallback
  //
  // Observação: para evitar mismatch de hidratação (SSR x client),
  // este app mostra sempre data absoluta (pt-BR).

  let d: Date | null = null

  const shorthand = input.trim().match(/^(\d+)\s*([smhdw])$/i)
  if (shorthand) {
    const n = Number(shorthand[1])
    const unit = shorthand[2].toLowerCase()
    if (Number.isFinite(n)) {
      const ms =
        unit === 's'
          ? n * 1000
          : unit === 'm'
            ? n * 60_000
            : unit === 'h'
              ? n * 3_600_000
              : unit === 'd'
                ? n * 86_400_000
                : unit === 'w'
                  ? n * 7 * 86_400_000
                  : 0
      d = new Date(Date.now() - ms)
    }
  } else {
    const parsed = new Date(input)
    if (!Number.isNaN(parsed.getTime())) d = parsed
  }

  // Se não conseguimos parsear, assume que é um texto pronto.
  if (!d) return input

  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(d)
}

const createdAtLabel = computed(() => formatCreatedAtPtBr(props.createdAt))
</script>

<template>
  <article
    class="group relative flex h-64 cursor-pointer flex-col overflow-hidden rounded-2xl border border-outline/40 bg-surface-container-lowest p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md dark:border-dark-outline/40 dark:bg-dark-surface-container-low"
    role="button"
    tabindex="0"
    @click="emit('select', id)"
    @keydown.enter.prevent="emit('select', id)"
    @keydown.space.prevent="emit('select', id)"
  >
    <div class="mb-4 flex items-start justify-between gap-4">
      <BaseAvatar
        :src="avatarSrc"
        :text="avatarText"
        :size="56"
        variant="rounded"
        :fallback-class="avatarGradientClass"
      />
      <span class="rounded-lg px-2.5 py-1 text-xs font-semibold" :class="statusStyles[status].cls">
        {{ statusStyles[status].label }}
      </span>
    </div>

    <h3 class="font-headline text-lg font-bold text-on-surface dark:text-dark-on-surface">
      {{ name }}
    </h3>
    <p class="mt-1 line-clamp-2 font-body text-sm text-on-surface-variant dark:text-dark-on-surface-variant">
      {{ description }}
    </p>

    <div class="mt-auto pt-4">
      <div class="flex items-center justify-between border-t border-outline/20 pt-4 dark:border-dark-outline/20">
        <div class="flex items-center gap-2">
          <div
            class="flex h-8 w-8 items-center justify-center rounded-full border border-outline/40 bg-surface-container-high text-on-surface-variant dark:border-dark-outline/40 dark:bg-dark-surface-container-high dark:text-dark-on-surface-variant"
            aria-hidden="true"
          >
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="8" r="3.2" />
              <path d="M6.5 19a6 6 0 0 1 11 0" stroke-linecap="round" />
            </svg>
          </div>
          <p class="text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
            <span class="font-semibold">ID:</span> {{ id }}
          </p>
        </div>

        <p class="inline-flex items-center gap-1 text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          {{ createdAtLabel }}
        </p>
      </div>
    </div>
  </article>
</template>

