<script setup lang="ts">
import { computed } from 'vue'
import type { Mensagem } from '#shared/types/mensagem'

const props = defineProps<{ mensagem: Mensagem }>()

const isFromMe = computed(() => Boolean(props.mensagem.from_me))
const filename = computed(() => (props.mensagem.filename ?? '').trim())
const caption = computed(() => (props.mensagem.caption ?? '').trim())
const url = computed(() => (props.mensagem.media_url ?? '').trim())

function formatHora(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(d)
}
const hora = computed(() => formatHora(props.mensagem.created_at))
</script>

<template>
  <div v-if="!isFromMe" class="mb-4 flex max-w-[70%] flex-col items-start">
    <div class="rounded-xl rounded-tl-none bg-surface-container-highest p-4 shadow-sm dark:bg-slate-800">
      <div class="flex items-center gap-2">
        <span class="material-symbols-outlined text-base text-on-surface-variant dark:text-slate-300" aria-hidden="true">
          description
        </span>
        <a
          v-if="url"
          :href="url"
          target="_blank"
          rel="noopener noreferrer"
          class="truncate font-body text-sm text-on-surface underline underline-offset-2 hover:text-primary dark:text-slate-200"
        >
          {{ filename || 'documento' }}
        </a>
        <span v-else class="truncate font-body text-sm text-on-surface dark:text-slate-200">
          {{ filename || 'documento' }}
        </span>

        <a
          v-if="url"
          :href="url"
          download
          class="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold text-primary hover:bg-surface-container-high dark:hover:bg-slate-700"
          aria-label="Baixar documento"
        >
          <span class="material-symbols-outlined text-[14px]" aria-hidden="true">download</span>
          Baixar
        </a>
      </div>

      <p v-if="caption" class="mt-2 font-body text-sm text-on-surface dark:text-slate-200">
        {{ caption }}
      </p>

      <span class="mt-1 block text-right text-[10px] text-on-surface-variant dark:text-slate-400">
        {{ hora }}
      </span>
    </div>
  </div>

  <div v-else class="mb-4 ml-auto flex max-w-[70%] flex-col items-end self-end">
    <div class="rounded-xl rounded-tr-none bg-primary-container p-4 shadow-sm">
      <div class="flex items-center gap-2">
        <span class="material-symbols-outlined text-base text-on-primary-container" aria-hidden="true">
          description
        </span>
        <a
          v-if="url"
          :href="url"
          target="_blank"
          rel="noopener noreferrer"
          class="truncate font-body text-sm text-on-primary-container underline underline-offset-2 hover:opacity-90"
        >
          {{ filename || 'documento' }}
        </a>
        <span v-else class="truncate font-body text-sm text-on-primary-container">
          {{ filename || 'documento' }}
        </span>

        <a
          v-if="url"
          :href="url"
          download
          class="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold text-on-primary-container hover:bg-black/5"
          aria-label="Baixar documento"
        >
          <span class="material-symbols-outlined text-[14px]" aria-hidden="true">download</span>
          Baixar
        </a>
      </div>

      <p v-if="caption" class="mt-2 font-body text-sm text-on-primary-container">
        {{ caption }}
      </p>

      <div class="mt-1 flex items-center justify-end gap-1">
        <span class="text-[10px] text-on-primary-container/80">{{ hora }}</span>
        <span class="material-symbols-outlined text-[12px] text-on-primary-container" aria-hidden="true">
          done_all
        </span>
      </div>
    </div>
  </div>
</template>

