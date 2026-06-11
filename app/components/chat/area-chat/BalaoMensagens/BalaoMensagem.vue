<script setup lang="ts">
import type { Mensagem } from '#shared/types/mensagem'
import type { MessageType } from '#shared/types/messageType'
import MessageAudio from '~/components/chat/area-chat/BalaoMensagens/MessageAudio.vue'
import MessageDocument from '~/components/chat/area-chat/BalaoMensagens/MessageDocument.vue'
import MessageImage from '~/components/chat/area-chat/BalaoMensagens/MessageImage.vue'
import MessageLocation from '~/components/chat/area-chat/BalaoMensagens/MessageLocation.vue'
import MessageSticker from '~/components/chat/area-chat/BalaoMensagens/MessageSticker.vue'
import MessageText from '~/components/chat/area-chat/BalaoMensagens/MessageText.vue'
import MessageUnsupported from '~/components/chat/area-chat/BalaoMensagens/MessageUnsupported.vue'
import MessageVideo from '~/components/chat/area-chat/BalaoMensagens/MessageVideo.vue'

const props = defineProps<{ mensagem: Mensagem }>()

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
</script>

<template>
  <MessageText v-if="isText" :mensagem="mensagem" />
  <MessageLocation v-else-if="isLocation" :mensagem="mensagem" />
  <MessageImage v-else-if="isImage" :mensagem="mensagem" />
  <MessageVideo v-else-if="isVideo" :mensagem="mensagem" />
  <MessageDocument v-else-if="isDoc" :mensagem="mensagem" />
  <MessageAudio v-else-if="isAudio" :mensagem="mensagem" />
  <MessageSticker v-else-if="isSticker" :mensagem="mensagem" />
  <MessageUnsupported v-else :mensagem="mensagem" />
</template>

