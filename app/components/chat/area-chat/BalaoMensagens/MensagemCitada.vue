<script setup lang="ts">
import { computed } from 'vue'
import type { Mensagem } from '#shared/types/mensagem'

const props = withDefaults(
  defineProps<{
    mensagem: Mensagem
    ehGrupo?: boolean
    fromMe?: boolean
  }>(),
  { ehGrupo: false, fromMe: false },
)

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
  if (props.ehGrupo) {
    const nome = (props.mensagem.name ?? '').trim()
    if (nome) return nome
  }
  return 'Contato'
})

const texto = computed(() => previewTexto(props.mensagem))
</script>

<template>
  <div
    class="mb-2 min-w-0 max-w-full overflow-hidden rounded-lg border-l-4 px-2 py-1.5"
    :class="
      fromMe
        ? 'border-on-primary-container/60 bg-on-primary-container/10'
        : 'border-primary bg-primary/5 dark:border-primary-300 dark:bg-primary/10'
    "
  >
    <p
      class="truncate text-[11px] font-semibold"
      :class="fromMe ? 'text-on-primary-container' : 'text-primary dark:text-primary-300'"
    >
      {{ autor }}
    </p>
    <p
      class="truncate text-[11px]"
      :class="fromMe ? 'text-on-primary-container/80' : 'text-on-surface-variant dark:text-slate-400'"
    >
      {{ texto }}
    </p>
  </div>
</template>
