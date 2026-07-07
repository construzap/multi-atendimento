<script setup lang="ts">
import { computed } from 'vue'
import type { Mensagem } from '#shared/types/mensagem'

const props = defineProps<{ mensagem: Mensagem }>()

const isFromMe = computed(() => Boolean(props.mensagem.from_me))
const isSending = computed(() => Boolean(props.mensagem.temp_id))
const url = computed(() => (props.mensagem.media_url ?? '').trim())
const caption = computed(() => (props.mensagem.caption ?? '').trim())

function formatHora(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(d)
}
const hora = computed(() => formatHora(props.mensagem.created_at))
</script>

<template>
  <div v-if="!isFromMe" class="mb-4 flex max-w-[70%] flex-col items-start">
    <div class="rounded-xl rounded-tl-none bg-surface-container-highest p-2 shadow-sm dark:bg-slate-800">
      <img
        :src="url"
        class="mb-2 max-h-64 w-full rounded-lg object-cover"
        alt="Imagem"
        loading="lazy"
      />
      <p v-if="caption" class="whitespace-pre-wrap break-words px-2 font-body text-sm text-on-surface dark:text-slate-200">
        {{ caption }}
      </p>
      <span class="mt-1 block px-2 text-right text-[10px] text-on-surface-variant dark:text-slate-400">
        {{ hora }}
      </span>
    </div>
  </div>

  <div v-else class="mb-4 ml-auto flex max-w-[70%] flex-col items-end self-end">
    <div class="rounded-xl rounded-tr-none bg-primary-container p-2 shadow-sm">
      <img
        :src="url"
        class="mb-2 max-h-64 w-full rounded-lg object-cover"
        alt="Imagem"
        loading="lazy"
      />
      <p v-if="caption" class="whitespace-pre-wrap break-words px-2 font-body text-sm text-on-primary-container">
        {{ caption }}
      </p>
      <div class="mt-1 flex items-center justify-end gap-1 px-2">
        <span class="text-[10px] text-on-primary-container/80">
          {{ hora }}<span v-if="isSending"> · enviando…</span>
        </span>
        <span class="material-symbols-outlined text-[12px] text-on-primary-container" aria-hidden="true">
          {{ isSending ? 'done' : 'done_all' }}
        </span>
      </div>
    </div>
  </div>
</template>

