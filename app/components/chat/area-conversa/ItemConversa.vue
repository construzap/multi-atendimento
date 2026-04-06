<script setup lang="ts">
import BaseAvatar from '~/components/BaseAvatar.vue'

withDefaults(
  defineProps<{
    nome: string
    ultimaMensagem: string
    horario: string
    avatarSrc?: string | null
    alt?: string
  }>(),
  {
    avatarSrc: null,
    alt: ''
  }
)
</script>

<template>
  <div
    class="group relative flex cursor-pointer items-center gap-4 rounded-xl border border-orange-100 bg-white p-3 shadow-sm transition-all dark:border-orange-900/30 dark:bg-slate-800"
  >
    <BaseAvatar
      :image-url="avatarSrc ?? undefined"
      :alt="alt || nome"
      :size="48"
      variant="circle"
    />

    <div class="min-w-0 flex-1">
      <div class="mb-0.5 flex items-baseline justify-between">
        <h3 class="truncate font-headline text-sm font-semibold text-slate-900 dark:text-slate-100">
          {{ nome }}
        </h3>
        <span class="shrink-0 text-[10px] text-on-surface-variant dark:text-slate-400">{{ horario }}</span>
      </div>
      <p class="truncate font-body text-xs text-on-surface-variant dark:text-slate-400">
        {{ ultimaMensagem }}
      </p>
    </div>

    <div
      class="absolute right-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100"
    >
      <button
        type="button"
        class="rounded-full bg-surface-container-low p-1 transition-colors hover:text-primary dark:bg-slate-700"
        aria-label="Ação anterior"
      >
        <span class="material-symbols-outlined text-sm" aria-hidden="true">chevron_left</span>
      </button>
      <button
        type="button"
        class="rounded-full bg-surface-container-low p-1 transition-colors hover:text-primary dark:bg-slate-700"
        aria-label="Próxima ação"
      >
        <span class="material-symbols-outlined text-sm" aria-hidden="true">chevron_right</span>
      </button>
    </div>
  </div>
</template>
