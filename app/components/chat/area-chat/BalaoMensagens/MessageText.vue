<script setup lang="ts">
import { computed } from 'vue'
import type { Mensagem } from '#shared/types/mensagem'

const props = defineProps<{
  mensagem: Mensagem
}>()

const isFromMe = computed(() => Boolean(props.mensagem.from_me))
const isSending = computed(() => Boolean(props.mensagem.temp_id))

function formatHora(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(d)
}

const hora = computed(() => formatHora(props.mensagem.created_at))
const texto = computed(() => (props.mensagem.message ?? '').trim())
</script>

<template>
  <!-- Recebida -->
  <div v-if="!isFromMe" class="mb-4 flex max-w-[70%] flex-col items-start">
    <div class="rounded-xl rounded-tl-none bg-surface-container-highest p-4 shadow-sm dark:bg-slate-800">
      <p class="font-body text-sm text-on-surface dark:text-slate-200">
        {{ texto }}
      </p>
      <span class="mt-1 block text-right text-[10px] text-on-surface-variant dark:text-slate-400">
        {{ hora }}
      </span>
    </div>
  </div>

  <!-- Enviada -->
  <div v-else class="mb-4 ml-auto flex max-w-[70%] flex-col items-end self-end">
    <div class="rounded-xl rounded-tr-none bg-primary-container p-4 shadow-sm">
      <p class="font-body text-sm text-on-primary-container">
        {{ texto }}
      </p>
      <div class="mt-1 flex items-center justify-end gap-1">
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

