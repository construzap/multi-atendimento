<script setup lang="ts">
import { computed } from 'vue'
import type { Mensagem } from '#shared/types/mensagem'

const props = defineProps<{
  mensagem: Mensagem
  nomeContato?: string | null
}>()

const emit = defineEmits<{
  cancelar: []
}>()

function previewTexto(m: Mensagem): string {
  const texto = (m.message ?? m.caption ?? '').trim()
  if (texto) return texto

  const t = m.messagetype
  if (t === 'imageMessage') return 'Foto'
  if (t === 'videoMessage') return 'Vídeo'
  if (t === 'audioMessage') return 'Áudio'
  if (t === 'documentMessage' || t === 'documentWithCaptionMessage') {
    return (m.filename ?? '').trim() || 'Documento'
  }
  if (t === 'stickerMessage' || t === 'lottieStickerMessage') return 'Figurinha'
  if (t === 'locationMessage' || t === 'liveLocationMessage') return 'Localização'
  return 'Mensagem'
}

const autor = computed(() => {
  if (props.mensagem.from_me) return 'Você'
  const nomeMsg = (props.mensagem.name ?? '').trim()
  if (nomeMsg) return nomeMsg
  const nomeContato = (props.nomeContato ?? '').trim()
  if (nomeContato) return nomeContato
  return 'Contato'
})

const texto = computed(() => previewTexto(props.mensagem))
</script>

<template>
  <div
    class="mb-3 flex items-stretch gap-3 rounded-xl bg-surface-container-low px-3 py-2.5 dark:bg-slate-800/80"
    role="region"
    aria-label="Respondendo mensagem"
  >
    <div class="w-1 shrink-0 rounded-full bg-primary" aria-hidden="true" />
    <div class="min-w-0 flex-1">
      <p class="truncate text-xs font-semibold text-primary dark:text-primary-300">
        {{ autor }}
      </p>
      <p class="truncate text-xs text-on-surface-variant dark:text-slate-400">
        {{ texto }}
      </p>
    </div>
    <button
      type="button"
      class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
      aria-label="Cancelar resposta"
      @click="emit('cancelar')"
    >
      <span class="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
    </button>
  </div>
</template>
