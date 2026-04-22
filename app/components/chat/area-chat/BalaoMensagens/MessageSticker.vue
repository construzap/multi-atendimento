<script setup lang="ts">
import { computed } from 'vue'
import type { Mensagem } from '#shared/types/mensagem'

const props = defineProps<{ mensagem: Mensagem }>()

const isFromMe = computed(() => Boolean(props.mensagem.from_me))
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
    <div class="rounded-xl rounded-tl-none bg-surface-container-highest p-2 shadow-sm dark:bg-slate-800">
      <img
        :src="url"
        class="max-h-40 w-40 rounded-lg object-contain"
        alt="Sticker"
        loading="lazy"
      />
      <span class="mt-1 block px-1 text-right text-[10px] text-on-surface-variant dark:text-slate-400">
        {{ hora }}
      </span>
    </div>
  </div>

  <div v-else class="mb-4 ml-auto flex max-w-[70%] flex-col items-end self-end">
    <div class="rounded-xl rounded-tr-none bg-primary-container p-2 shadow-sm">
      <img
        :src="url"
        class="max-h-40 w-40 rounded-lg object-contain"
        alt="Sticker"
        loading="lazy"
      />
      <div class="mt-1 flex items-center justify-end gap-1 px-1">
        <span class="text-[10px] text-on-primary-container/80">{{ hora }}</span>
        <span class="material-symbols-outlined text-[12px] text-on-primary-container" aria-hidden="true">
          done_all
        </span>
      </div>
    </div>
  </div>
</template>

