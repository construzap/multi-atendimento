<script setup lang="ts">
import BaseAvatar from '~/components/BaseAvatar.vue'
import type { MessageType } from '#shared/types/messageType'

const props = withDefaults(
  defineProps<{
    /** Chave/ID da conversa (ex.: phone ou lid). */
    conversaId: string
    nome: string
    ultimaMensagem: string
    horario: string
    avatarSrc?: string | null
    alt?: string
    selected?: boolean
    messatype?: MessageType | null
  }>(),
  {
    avatarSrc: null,
    alt: '',
    selected: false,
    messatype: null
  }
)

const emit = defineEmits<{
  select: []
}>()

const conversas = useConversasStore()

function emojiByType(t: MessageType | null | undefined): string {
  if (!t || t === 'conversation') return ''
  switch (t) {
    case 'audioMessage':
      return '🎧'
    case 'imageMessage':
      return '🖼️'
    case 'videoMessage':
      return '🎥'
    case 'documentMessage':
    case 'documentWithCaptionMessage':
      return '📄'
    case 'stickerMessage':
    case 'lottieStickerMessage':
      return '🧩'
    case 'locationMessage':
    case 'liveLocationMessage':
      return '📍'
    case 'contactMessage':
    case 'contactsArrayMessage':
      return '👤'
    case 'reactionMessage':
      return '❤️'
    case 'buttonsMessage':
    case 'listMessage':
    case 'interactiveMessage':
    case 'templateMessage':
    case 'templateButtonReplyMessage':
      return '🧭'
    case 'orderMessage':
    case 'productMessage':
      return '🛒'
    case 'groupInviteMessage':
      return '👥'
    case 'editedMessage':
      return '✏️'
    case 'ephemeralMessage':
    case 'viewOnceMessage':
      return '⏳'
    case 'pinInChatMessage':
      return '📌'
    case 'placeholderMessage':
    case 'unknown':
    case 'desconhecido':
    case 'ptvMessage':
    case 'associatedChildMessage':
    case 'extendedTextMessage':
      return '💬'
  }
}

const preview = computed(() => {
  const emoji = emojiByType(props.messatype)
  if (!emoji) return props.ultimaMensagem
  return `${emoji} ${props.ultimaMensagem}`.trim()
})

function onSelect() {
  conversas.setConversaAtual(props.conversaId)
  emit('select')
}
</script>

<template>
  <div
    class="group relative flex cursor-pointer items-center gap-4 rounded-xl border bg-white p-3 shadow-sm transition-all dark:bg-slate-800"
    :class="
      props.selected
        ? 'border-primary/30 ring-1 ring-primary/20 dark:border-primary/40'
        : 'border-orange-100 dark:border-orange-900/30'
    "
    @click="onSelect"
  >
    <span
      v-if="props.selected"
      class="absolute left-0 top-2 bottom-2 w-1 rounded-r bg-primary"
      aria-hidden="true"
    />
    <BaseAvatar
      :image-url="avatarSrc ?? undefined"
      :alt="alt || nome"
      :size="48"
      variant="circle"
    />

    <div class="min-w-0 flex-1">
      <div class="mb-0.5 flex items-baseline justify-between">
        <h3 class="truncate font-headline text-sm font-semibold text-slate-900 dark:text-slate-100">
          {{ nome }}
        </h3>
        <span class="shrink-0 text-[10px] text-on-surface-variant dark:text-slate-400">{{ horario }}</span>
      </div>
      <p class="truncate font-body text-xs text-on-surface-variant dark:text-slate-400">
        {{ preview }}
      </p>
    </div>

    <div
      class="absolute right-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100"
    >
      <button
        type="button"
        class="rounded-full bg-surface-container-low p-1 transition-colors hover:text-primary dark:bg-slate-700"
        aria-label="Ação anterior"
      >
        <span class="material-symbols-outlined text-sm" aria-hidden="true">chevron_left</span>
      </button>
      <button
        type="button"
        class="rounded-full bg-surface-container-low p-1 transition-colors hover:text-primary dark:bg-slate-700"
        aria-label="Próxima ação"
      >
        <span class="material-symbols-outlined text-sm" aria-hidden="true">chevron_right</span>
      </button>
    </div>
  </div>
</template>
