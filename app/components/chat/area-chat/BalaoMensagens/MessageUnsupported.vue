<script setup lang="ts">
import { computed } from 'vue'
import type { Mensagem } from '#shared/types/mensagem'

const props = withDefaults(
  defineProps<{
    mensagem: Mensagem
    /** `midia_sem_url` = upload B2 falhou / sem link; default = tipo não suportado. */
    motivo?: 'midia_sem_url' | 'incompativel'
  }>(),
  {
    motivo: 'incompativel',
  },
)

const isFromMe = computed(() => Boolean(props.mensagem.from_me))
const isSending = computed(() => Boolean(props.mensagem.temp_id))

function formatHora(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(d)
}
const hora = computed(() => formatHora(props.mensagem.created_at))

const tipo = computed(() => props.mensagem.messagetype ?? 'unknown')

const titulo = computed(() => {
  if (props.motivo === 'midia_sem_url') {
    return 'Mídia indisponível neste painel. Veja no aplicativo do celular.'
  }
  return 'Mensagem incompatível. Veja no aplicativo do celular.'
})

const labelTipo = computed(() => {
  if (props.motivo === 'midia_sem_url') {
    const map: Record<string, string> = {
      imageMessage: 'Imagem',
      videoMessage: 'Vídeo',
      audioMessage: 'Áudio',
      documentMessage: 'Documento',
      documentWithCaptionMessage: 'Documento',
      stickerMessage: 'Figurinha',
      lottieStickerMessage: 'Figurinha',
    }
    return map[tipo.value] ?? tipo.value
  }
  return `Tipo: ${tipo.value}`
})
</script>

<template>
  <div v-if="!isFromMe" class="mb-4 flex max-w-[70%] flex-col items-start">
    <div class="rounded-xl rounded-tl-none bg-surface-container-highest p-4 shadow-sm dark:bg-slate-800">
      <div class="flex items-start gap-2">
        <span class="material-symbols-outlined mt-0.5 text-base text-zinc-600 dark:text-slate-300" aria-hidden="true">
          smartphone
        </span>
        <p class="font-body text-sm text-zinc-950 dark:text-slate-200">
          {{ titulo }}
        </p>
      </div>
      <span class="mt-1 block text-[10px] text-zinc-600 dark:text-slate-400">
        {{ labelTipo }}
      </span>
      <span class="mt-1 block text-right text-[10px] text-zinc-600 dark:text-slate-400">
        {{ hora }}
      </span>
    </div>
  </div>

  <div v-else class="mb-4 ml-auto flex max-w-[70%] flex-col items-end self-end">
    <div class="rounded-xl rounded-tr-none bg-primary-container p-4 shadow-sm">
      <div class="flex items-start gap-2">
        <span class="material-symbols-outlined mt-0.5 text-base text-on-primary-container" aria-hidden="true">
          smartphone
        </span>
        <p class="font-body text-sm text-on-primary-container">
          {{ titulo }}
        </p>
      </div>
      <span class="mt-1 block text-[10px] text-on-primary-container/80">{{ labelTipo }}</span>
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
