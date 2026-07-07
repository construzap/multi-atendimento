<script setup lang="ts">
import BaseAvatar from '~/components/BaseAvatar.vue'
import type { MessageType } from '#shared/types/messageType'
import { useConversasStore } from '~/stores/conversas'

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
  fechada?: boolean
  isGrupo?: boolean
  naoLidas?: number
  }>(),
  {
    avatarSrc: null,
    alt: '',
    selected: false,
    messatype: null,
    fechada: false,
    isGrupo: false,
    naoLidas: 0,
  }
)

const emit = defineEmits<{
  select: []
}>()

const conversas = useConversasStore()
const route = useRoute()

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

const temNaoLidas = computed(() => (props.naoLidas ?? 0) >= 1)

const naoLidasLabel = computed(() => {
  const n = props.naoLidas ?? 0
  if (n < 1) return ''
  return n > 99 ? '99+' : String(n)
})

function onSelect() {
  conversas.setConversaAtual(props.conversaId)
  emit('select')

  const workspaceId = route.params.id
  const canalId = route.params.canalId
  if (!workspaceId || !canalId) return

  void navigateTo(
    `/workspaces/${workspaceId}/chat/${canalId}/${encodeURIComponent(props.conversaId)}`,
    { replace: true },
  )
}
</script>

<template>
  <div
    class="group relative flex cursor-pointer items-center gap-4 rounded-xl border bg-white p-3 shadow-sm transition-all dark:bg-slate-800"
    :class="
      props.selected
        ? 'border-primary/30 ring-1 ring-primary/20 dark:border-primary/40'
        : props.fechada
          ? 'border-slate-200 opacity-75 dark:border-slate-700'
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
        <div class="flex shrink-0 items-center gap-1.5">
          <span
            v-if="props.isGrupo"
            class="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary dark:bg-primary/20"
          >
            Grupo
          </span>
          <span
            v-if="props.fechada"
            class="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-700 dark:text-slate-300"
          >
            Fechada
          </span>
          <span class="text-[10px] text-on-surface-variant dark:text-slate-400">{{ horario }}</span>
        </div>
      </div>
      <p class="flex items-center gap-2 font-body text-xs text-on-surface-variant dark:text-slate-400">
        <span class="min-w-0 flex-1 truncate">{{ preview }}</span>
        <span
          v-if="temNaoLidas"
          class="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#25D366] px-1.5 text-[11px] font-semibold leading-none text-white shadow-sm"
          :aria-label="`${naoLidasLabel} mensagem${(props.naoLidas ?? 0) === 1 ? '' : 's'} não lida${(props.naoLidas ?? 0) === 1 ? '' : 's'}`"
        >
          {{ naoLidasLabel }}
        </span>
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
