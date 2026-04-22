<script setup lang="ts">
import type { Mensagem } from '#shared/types/mensagem'
import type { MessageType } from '#shared/types/messageType'
import MessageAudio from '~/components/chat/area-chat/BalaoMensagens/MessageAudio.vue'
import MessageDocument from '~/components/chat/area-chat/BalaoMensagens/MessageDocument.vue'
import MessageImage from '~/components/chat/area-chat/BalaoMensagens/MessageImage.vue'
import MessageSticker from '~/components/chat/area-chat/BalaoMensagens/MessageSticker.vue'
import MessageText from '~/components/chat/area-chat/BalaoMensagens/MessageText.vue'
import MessageUnsupported from '~/components/chat/area-chat/BalaoMensagens/MessageUnsupported.vue'
import MessageVideo from '~/components/chat/area-chat/BalaoMensagens/MessageVideo.vue'

const props = defineProps<{ mensagem: Mensagem }>()

function normalize(t: MessageType | null): MessageType | null {
  return t
}

const t = computed(() => normalize(props.mensagem.messagetype))

const isText = computed(() => t.value == null || t.value === 'conversation' || t.value === 'extendedTextMessage')
const isImage = computed(() => t.value === 'imageMessage')
const isVideo = computed(() => t.value === 'videoMessage')
const isDoc = computed(() => t.value === 'documentMessage' || t.value === 'documentWithCaptionMessage')
const isAudio = computed(() => t.value === 'audioMessage')
const isSticker = computed(() => t.value === 'stickerMessage' || t.value === 'lottieStickerMessage')
</script>

<template>
  <MessageText v-if="isText" :mensagem="mensagem" />
  <MessageImage v-else-if="isImage" :mensagem="mensagem" />
  <MessageVideo v-else-if="isVideo" :mensagem="mensagem" />
  <MessageDocument v-else-if="isDoc" :mensagem="mensagem" />
  <MessageAudio v-else-if="isAudio" :mensagem="mensagem" />
  <MessageSticker v-else-if="isSticker" :mensagem="mensagem" />
  <MessageUnsupported v-else :mensagem="mensagem" />
</template>

