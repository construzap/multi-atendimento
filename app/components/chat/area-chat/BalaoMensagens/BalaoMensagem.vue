<script setup lang="ts">
import { computed } from 'vue'
import type { Mensagem } from '#shared/types/mensagem'
import type { MessageType } from '#shared/types/messageType'
import IaMensagemSelo from '~/components/chat/area-chat/BalaoMensagens/IaMensagemSelo.vue'
import MessageAudio from '~/components/chat/area-chat/BalaoMensagens/MessageAudio.vue'
import MessageDocument from '~/components/chat/area-chat/BalaoMensagens/MessageDocument.vue'
import MessageImage from '~/components/chat/area-chat/BalaoMensagens/MessageImage.vue'
import MessageLocation from '~/components/chat/area-chat/BalaoMensagens/MessageLocation.vue'
import MessageSticker from '~/components/chat/area-chat/BalaoMensagens/MessageSticker.vue'
import MessageText from '~/components/chat/area-chat/BalaoMensagens/MessageText.vue'
import MessageUnsupported from '~/components/chat/area-chat/BalaoMensagens/MessageUnsupported.vue'
import MessageVideo from '~/components/chat/area-chat/BalaoMensagens/MessageVideo.vue'

const props = withDefaults(defineProps<{ mensagem: Mensagem; ehGrupo?: boolean }>(), {
  ehGrupo: false,
})

const AUDIO_EXTS = new Set(['webm', 'ogg', 'mp3', 'm4a', 'aac', 'wav', 'opus'])

function extensaoDeNomeOuUrl(filename: string | null | undefined, mediaUrl: string | null | undefined): string {
  const name = (filename ?? '').trim().toLowerCase()
  if (name.includes('.')) {
    const fromName = name.split('.').pop() ?? ''
    if (fromName) return fromName.replace(/[^a-z0-9]/g, '')
  }
  const url = (mediaUrl ?? '').trim().toLowerCase().split('?')[0] ?? ''
  if (url.includes('.')) {
    const fromUrl = url.split('.').pop() ?? ''
    return fromUrl.replace(/[^a-z0-9]/g, '')
  }
  return ''
}

/** PTT e áudios gravados no app podem vir como documentMessage no banco — exibir como áudio. */
function normalize(t: MessageType | null, mensagem: Mensagem): MessageType | null {
  if (t === 'audioMessage') return t
  const isDoc = t === 'documentMessage' || t === 'documentWithCaptionMessage'
  if (!isDoc) return t

  const name = (mensagem.filename ?? '').trim().toLowerCase()
  const ext = extensaoDeNomeOuUrl(mensagem.filename, mensagem.media_url)
  if (name.startsWith('audio_') || AUDIO_EXTS.has(ext)) {
    return 'audioMessage'
  }
  return t
}

const t = computed(() => normalize(props.mensagem.messagetype, props.mensagem))

const isText = computed(() => t.value == null || t.value === 'conversation' || t.value === 'extendedTextMessage')
const isImage = computed(() => t.value === 'imageMessage')
const isVideo = computed(() => t.value === 'videoMessage')
const isDoc = computed(() => t.value === 'documentMessage' || t.value === 'documentWithCaptionMessage')
const isAudio = computed(() => t.value === 'audioMessage')
const isSticker = computed(() => t.value === 'stickerMessage' || t.value === 'lottieStickerMessage')
const isLocation = computed(
  () => t.value === 'locationMessage' || t.value === 'liveLocationMessage'
)

const ehIaEnvio = computed(() => Boolean(props.mensagem.from_ia && props.mensagem.from_me))

const mensagensStore = useMensagensStore()

const mensagemCitada = computed(() => {
  if (props.mensagem.mensagem_citada) return props.mensagem.mensagem_citada
  const id = props.mensagem.replyid?.trim()
  if (!id) return null
  return mensagensStore.mensagemPorId(id)
})

function onResponder() {
  mensagensStore.iniciarResposta(props.mensagem)
}
</script>

<template>
  <div
    class="group relative flex w-full"
    :class="mensagem.from_me ? 'justify-end' : 'justify-start'"
  >
    <div
      class="relative flex w-full min-w-0 max-w-[70%] flex-col"
      :class="mensagem.from_me ? 'items-end' : 'items-start'"
    >
      <button
        type="button"
        class="absolute top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200/80 bg-white text-slate-500 opacity-0 shadow-sm transition hover:bg-slate-50 hover:text-primary group-hover:opacity-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-primary-300"
        :class="mensagem.from_me ? '-left-9' : '-right-9'"
        aria-label="Responder mensagem"
        @click="onResponder"
      >
        <span class="material-symbols-outlined text-[18px]" aria-hidden="true">reply</span>
      </button>

      <div v-if="ehIaEnvio" class="mb-1 flex justify-end self-end">
        <IaMensagemSelo />
      </div>
      <MessageText
        v-if="isText"
        :mensagem="mensagem"
        :eh-grupo="props.ehGrupo"
        :mensagem-citada="mensagemCitada"
      />
      <MessageLocation v-else-if="isLocation" :mensagem="mensagem" />
      <MessageImage v-else-if="isImage" :mensagem="mensagem" />
      <MessageVideo v-else-if="isVideo" :mensagem="mensagem" />
      <MessageDocument v-else-if="isDoc" :mensagem="mensagem" />
      <MessageAudio v-else-if="isAudio" :mensagem="mensagem" />
      <MessageSticker v-else-if="isSticker" :mensagem="mensagem" />
      <MessageUnsupported v-else :mensagem="mensagem" />
    </div>
  </div>
</template>

